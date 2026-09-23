import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Window } from "happy-dom";

const libRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = resolve(libRoot, "..");
const window = new Window({ url: "https://example.test" });
Object.assign(globalThis, {
    window, document: window.document, Node: window.Node, Element: window.Element, HTMLElement: window.HTMLElement,
    ShadowRoot: window.ShadowRoot, MutationObserver: window.MutationObserver,
    DOMParser: window.DOMParser, getComputedStyle: window.getComputedStyle.bind(window),
    requestAnimationFrame: callback => setTimeout(() => callback(Date.now()), 0),
    cancelAnimationFrame: clearTimeout,
});
Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true });
await import(pathToFileURL(resolve(libRoot, "dist.js")));

const source = name => readFileSync(resolve(root, `src/elements/tiptap-AAC/${name}.js`), "utf8");
const initialize = new Function("instance", "context", "setTimeout", "clearTimeout", "setInterval", "clearInterval", source("initialize"));
const update = new Function("instance", "properties", "context", source("update"));
const metadata = JSON.parse(readFileSync(resolve(root, "src/elements/tiptap-AAC/AAC.json"), "utf8"));
const defaults = Object.fromEntries(Object.values(metadata.fields).map(field => [field.name, field.default_val]));

// Deterministic plugin clock; the real editor/provider keep their own async lifecycle.
function makeClock() {
    let now = 0, sequence = 0;
    const timers = new Map();
    const delays = [];
    function schedule(callback, delay = 0, interval = false) {
        const id = ++sequence;
        timers.set(id, { callback, at: now + delay, delay, interval });
        if (!interval && delay >= 1000) delays.push(delay);
        return id;
    }
    return {
        timers, delays, schedule,
        cancel: id => timers.delete(id),
        advance(ms) {
            const end = now + ms;
            for (;;) {
                const next = [...timers].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
                if (!next) break;
                const [id, timer] = next;
                now = timer.at;
                if (timer.interval) timer.at += timer.delay;
                else timers.delete(id);
                timer.callback();
            }
            now = end;
        },
    };
}

const providers = [];
const RealProvider = window.tiptap.HocuspocusProvider;
class Provider extends RealProvider {
    constructor(options) {
        // Exercise real SDK ownership/disposal, without opening a remote connection.
        super({ ...options, autoConnect: false, WebSocketPolyfill: window.WebSocket });
        this.options = options;
        this.destroyCalls = 0;
        this.documentDestroyCalls = 0;
        this.socketDestroyCalls = 0;
        this.awarenessDestroyCalls = 0;
        this.document.on("destroy", () => this.documentDestroyCalls++);
        this.configuration.websocketProvider.on("destroy", () => this.socketDestroyCalls++);
        this.awareness.on("destroy", () => this.awarenessDestroyCalls++);
        providers.push(this);
    }
    destroy() {
        this.destroyCalls++;
        // Teardown may synchronously deliver queued provider callbacks.
        this.options.onAuthenticationFailed({ reason: "destroy callback" });
        this.options.onAuthenticated();
        this.options.onConnect();
        super.destroy();
    }
}
window.tiptap.HocuspocusProvider = Provider;

async function makeHarness(overrides = {}) {
    const canvas = document.createElement("div");
    document.body.appendChild(canvas);
    const clock = makeClock(), states = new Map(), events = [], messages = [];
    const instance = {
        data: {},
        canvas: { 0: canvas, css() {}, append: node => canvas.appendChild(node), parent: () => ({ length: 0 }), height() {} },
        publishState: (name, value) => states.set(name, value), triggerEvent: name => events.push(name),
        publishAutobinding() {}, canUploadFile: () => true, uploadFile() {},
    };
    const context = { reportDebugger: message => messages.push(String(message)) };
    initialize(instance, context, clock.schedule, clock.cancel,
        (callback, delay) => clock.schedule(callback, delay, true), clock.cancel);
    const properties = {
        ...defaults, initialContent: "<p>Seed</p>", content_is_json: false, isEditable: true,
        collab_active: true, collabProvider: "custom", collab_url: "wss://example.test",
        collab_app_id: "app", collab_doc_id: "doc-fixture", collab_jwt: "token-fixture",
        ...overrides,
        bubble: { auto_binding: () => false, fit_height: () => false, font_size: () => 16,
            font_color: () => "#111111", font_face: () => "Arial:400" },
    };
    const h = {
        instance, properties, states, events, messages, clock, canvas,
        async change(values = {}) {
            Object.assign(properties, values);
            update(instance, properties, context);
            await window.happyDOM.whenAsyncComplete();
        },
        async advance(ms) { clock.advance(ms); await window.happyDOM.whenAsyncComplete(); },
        close() { instance.data.teardownEditor("test complete"); canvas.remove(); },
    };
    await h.change();
    return h;
}

async function exhaust(h) {
    const attempts = [], editors = [];
    for (let attempt = 1; attempt <= 5; attempt++) {
        const provider = h.instance.data.provider;
        attempts.push(provider);
        editors.push(h.instance.data.editor);
        provider.options.onAuthenticationFailed({ reason: "rejected" });
        assert.equal(h.instance.data._collabRetryCount, attempt, "teardown preserves attempt progress");
        if (attempt < 5) {
            assert.equal(h.states.get("is_ready"), false);
            await h.change();
            assert.equal(h.instance.data.provider, null, "unchanged update must wait for backoff");
            const delay = [1000, 2000, 4000, 8000][attempt - 1];
            await h.advance(delay - 1);
            assert.equal(h.instance.data.provider, null, "no early retry");
            await h.advance(1);
            assert.notEqual(h.instance.data.provider, provider);
        }
    }
    assert.equal(new Set(attempts).size, 5, "five total attempts, not five retries");
    assert.deepEqual(h.clock.delays, [1000, 2000, 4000, 8000]);
    assert.equal(attempts[4].destroyCalls, 1, "terminal failure must destroy the fifth provider");
    assert.ok(attempts.every(provider => provider.destroyCalls === 1));
    assert.ok(attempts.every(provider => provider.documentDestroyCalls === 1));
    assert.ok(attempts.every(provider => provider.socketDestroyCalls === 1));
    assert.ok(attempts.every(provider => provider.awarenessDestroyCalls === 1));
    assert.ok(attempts.every(provider => provider.configuration.websocketProvider.configuration.providerMap.size === 0));
    assert.equal(h.instance.data._pendingCollabDocument, null, "no preserved CRDT resource remains at exhaustion");
    assert.ok(attempts.every(provider => provider.configuration.websocketProvider.shouldConnect === false));
    assert.ok(editors.every(editor => editor.isDestroyed));
    assert.equal(h.instance.data.provider, null);
    assert.equal(h.instance.data.editor, null);
    assert.equal(h.states.get("is_ready"), false);
    assert.equal(h.states.get("collab_status"), "failed");
    assert.equal(h.states.get("collab_synced"), false);
    assert.equal(h.states.get("collab_connected_users"), 0);
    assert.equal(h.canvas.querySelector(".tiptap"), null);
    assert.equal(h.clock.timers.size, 0, "no polling, debounce or retry timers remain");
    assert.equal(h.messages.filter(message => /failed after 5 attempts/.test(message)).length, 1);
    return attempts;
}

const warn = console.warn;
try {
    console.warn = () => {};
    for (const collabProvider of ["custom", "tiptap"]) {
        const healthy = await makeHarness({ collabProvider, collab_doc_id: "another-instance" });
        const healthyProvider = healthy.instance.data.provider;
        healthyProvider.options.onAuthenticated();
        healthyProvider.options.onSynced();
        const healthyStates = new Map(healthy.states);
        const h = await makeHarness({ collabProvider });
        const attempts = await exhaust(h);
        const terminalStates = new Map(h.states);
        const terminalEvents = [...h.events];
        const providerCount = providers.length;
        for (const provider of attempts) {
            provider.options.onAuthenticationFailed({ reason: "late rejection" });
            provider.options.onAuthenticated();
            provider.options.onConnect();
            provider.options.onStatus({ status: "connected" });
            provider.options.onSynced();
            provider.options.onDisconnect();
            provider.options.onAwarenessChange({ states: [{ user: {} }] });
            provider.emit("synced", { state: true });
        }
        assert.deepEqual(h.states, terminalStates, "old-generation callbacks cannot change terminal states");
        assert.deepEqual(h.events, terminalEvents, "old callbacks cannot emit Bubble events");
        for (let i = 0; i < 3; i++) await h.change();
        await h.change({ collab_user_name: "New display name", collab_cursor_color: "#123456",
            collab_url: "wss://example.test/", liveblocksPublicApiKey: "unused-key" });
        await h.advance(1_000_000);
        assert.equal(providers.length, providerCount, "unchanged configuration cannot restart exhausted budget");
        assert.deepEqual(h.states, terminalStates);
        assert.equal(h.instance.data._collabRetryCount, 5);
        assert.equal(h.clock.timers.size, 0);
        assert.equal(healthy.instance.data.provider, healthyProvider);
        assert.deepEqual(healthy.states, healthyStates, "failure is isolated to its Bubble instance");

        await h.change({ collab_jwt: "renewed-token" });
        const recovered = h.instance.data.provider;
        assert.ok(recovered, "changed credentials recover terminal failure");
        assert.equal(h.states.get("is_ready"), true);
        assert.equal(h.instance.data._collabRetryCount, 0, "explicit restart has a fresh budget");
        const recoveredStates = new Map(h.states);
        attempts[4].options.onAuthenticationFailed({ reason: "obsolete terminal callback" });
        attempts[4].options.onAuthenticated();
        attempts[4].options.onDisconnect();
        attempts[4].options.onSynced();
        assert.equal(h.instance.data.provider, recovered);
        assert.deepEqual(h.states, recoveredStates, "stale callbacks cannot mutate the recovered editor");

        recovered.options.onAuthenticationFailed({ reason: "rejected" });
        assert.equal(h.instance.data._collabRetryCount, 1);
        const queuedRetry = [...h.clock.timers.values()].find(timer => timer.delay === 1000).callback;
        await h.change({ collab_jwt: "next-token" });
        const next = h.instance.data.provider;
        queuedRetry(); // A timer already queued at cancellation must also be harmless.
        assert.equal(h.instance.data.provider, next);
        assert.equal(h.instance.data._collabRetryCount, 0);
        next.options.onAuthenticationFailed({ reason: "rejected" });
        await h.advance(1000);
        h.instance.data.provider.options.onAuthenticationFailed({ reason: "rejected" });
        assert.equal(h.instance.data._collabRetryCount, 2);
        await h.advance(2000);
        h.instance.data.provider.options.onAuthenticated();
        assert.equal(h.instance.data._collabRetryCount, 0, "successful authentication resets consecutive failures");
        h.instance.data.provider.options.onAuthenticationFailed({ reason: "rejected after success" });
        assert.equal(h.instance.data._collabRetryCount, 1);
        assert.equal(h.clock.delays.at(-1), 1000, "success restores the first backoff delay");
        await h.change({ collab_active: false });
        assert.equal(h.instance.data.editor.commands.updateUser, undefined);
        assert.equal(h.states.get("is_ready"), true);
        assert.equal(h.instance.data.provider, null);
        await h.advance(1_000_000);
        assert.equal(h.instance.data.provider, null, "local mode cancels retry");
        h.close();
        healthy.close();
    }

    // Every relevant construction change can recover, including leaving collaboration.
    for (const values of [
        { collab_active: false }, { collab_doc_id: "new-document" },
        { collab_url: "wss://other.test" }, { collab_app_id: "other-app" },
        { collabProvider: "tiptap" }, { ext_ai_toolkit: true }, { collab_jwt: "" },
    ]) {
        const h = await makeHarness();
        const attempts = await exhaust(h);
        h.instance.data.teardownEditor("repeat cleanup");
        h.instance.data.teardownEditor("repeat cleanup");
        assert.ok(attempts.every(provider => provider.destroyCalls === 1), "cleanup is idempotent");
        assert.equal(h.states.get("collab_status"), "failed");
        await h.change(values);
        if (values.collab_jwt === "") {
            assert.equal(h.instance.data.editor, null, "missing credentials still wait for prerequisites");
            await h.change({ collab_jwt: "restored-token" });
        }
        assert.equal(h.states.get("is_ready"), true);
        assert.equal(h.instance.data._collabRetryCount, 0);
        if (values.collab_active === false) {
            assert.equal(h.instance.data.provider, null);
            assert.equal(h.instance.data.editor.commands.updateUser, undefined);
        } else {
            assert.ok(h.instance.data.provider);
        }
        h.close();
    }

    // Terminal disposal returns Bubble-owned menus, allowing the same nodes to recover.
    for (const type of ["bubbleMenu", "floatingMenu"]) {
        const parent = document.createElement("section");
        const menu = document.createElement("div");
        const sibling = document.createElement("span");
        menu.id = `auth-${type}`;
        menu.setAttribute("style", "color: red; position: relative;");
        parent.append(menu, sibling);
        document.body.append(parent);
        const originalStyle = menu.getAttribute("style");
        const h = await makeHarness({ [type]: menu.id });
        await exhaust(h);
        assert.equal(menu.parentNode, parent);
        assert.equal(menu.nextSibling, sibling);
        assert.equal(menu.getAttribute("style"), originalStyle);
        await h.change({ collab_jwt: "menu-recovery-token" });
        assert.equal(h.states.get("is_ready"), true);
        assert.equal(h.instance.data._menuLeases.length, 1, "recovery reuses the Bubble menu");
        h.close();
        assert.equal(menu.parentNode, parent);
        parent.remove();
    }

    // Unchanged Bubble workflows may re-enter update on every status transition.
    // They must not reset progress during teardown or bypass/double-fire backoff.
    {
        const h = await makeHarness();
        const triggerEvent = h.instance.triggerEvent;
        const updates = [];
        h.instance.triggerEvent = name => {
            triggerEvent(name);
            if (name === "collab_status_changed") updates.push(h.change());
        };
        const before = providers.length;
        await exhaust(h);
        await Promise.all(updates);
        assert.equal(providers.length - before, 4, "status workflows cannot create extra providers");
        h.instance.triggerEvent = triggerEvent;
        h.close();
    }

    // Bubble status workflows can change credentials synchronously during teardown.
    for (const failureNumber of [1, 5]) {
        const h = await makeHarness();
        for (let attempt = 1; attempt < failureNumber; attempt++) {
            h.instance.data.provider.options.onAuthenticationFailed({ reason: "rejected" });
            await h.advance([1000, 2000, 4000, 8000][attempt - 1]);
        }
        const old = h.instance.data.provider;
        let recovery;
        const triggerEvent = h.instance.triggerEvent;
        h.instance.triggerEvent = name => {
            triggerEvent(name);
            if (name === "collab_status_changed" && !recovery) {
                // Unhook before update() can synchronously emit another status event.
                h.instance.triggerEvent = triggerEvent;
                recovery = h.change({ collab_jwt: "workflow-renewed-token" });
            }
        };
        old.options.onAuthenticationFailed({ reason: "rejected" });
        await recovery;
        assert.equal(h.states.get("is_ready"), true);
        assert.notEqual(h.instance.data.provider, old);
        assert.equal(h.instance.data._collabRetryCount, 0, "returning teardown cannot overwrite a newer budget");
        h.instance.data.provider.options.onAuthenticationFailed({ reason: "new rejection" });
        assert.equal(h.instance.data._collabRetryCount, 1);
        await h.advance(1000);
        assert.ok(h.instance.data.provider, "new generation gets its own retries");
        h.close();
    }

    // A configuration change from the retrying event owns the next setup too.
    {
        const h = await makeHarness();
        h.instance.data.provider.options.onAuthenticationFailed({ reason: "rejected" });
        const triggerEvent = h.instance.triggerEvent;
        let recovery;
        h.instance.triggerEvent = name => {
            triggerEvent(name);
            if (name === "collab_status_changed" && h.states.get("collab_status") === "retrying") {
                h.instance.triggerEvent = triggerEvent;
                recovery = h.change({ collab_jwt: "retry-event-token" });
            }
        };
        const before = providers.length;
        await h.advance(1000);
        await recovery;
        assert.equal(providers.length - before, 1, "returning retry timer cannot set up a duplicate editor");
        assert.equal(h.states.get("is_ready"), true);
        assert.equal(h.instance.data._collabRetryCount, 0);
        h.close();
    }

    // Provider-controlled reasons can echo tokens or private document identifiers.
    for (const collabProvider of ["custom", "tiptap"]) {
        const output = [], log = console.log;
        console.log = (...args) => output.push(args.join(" "));
        console.warn = (...args) => output.push(args.join(" "));
        try {
            const h = await makeHarness({ collabProvider, debug_mode: true,
                collab_jwt: "PRIVATE-JWT", collab_doc_id: "PRIVATE-DOCUMENT" });
            for (let attempt = 0; attempt < 5; attempt++) {
                h.instance.data.provider.options.onAuthenticationFailed({
                    reason: "Denied token PRIVATE-JWT for PRIVATE-DOCUMENT",
                });
                if (attempt < 4) await h.advance([1000, 2000, 4000, 8000][attempt]);
            }
            const diagnostics = JSON.stringify([output, h.messages, [...h.states]]);
            assert.doesNotMatch(diagnostics, /PRIVATE-JWT|PRIVATE-DOCUMENT/, "authentication diagnostics must not leak credentials or document identifiers");
            h.close();
        } finally {
            console.log = log;
            console.warn = () => {};
        }
    }
} finally {
    console.warn = warn;
    await window.happyDOM.close();
}
assert.ok(providers.every(provider => provider.destroyCalls === 1 && provider.socketDestroyCalls === 1 &&
    provider.documentDestroyCalls === 1 && provider.awarenessDestroyCalls === 1), "all fixture resources disposed exactly once");
console.log("Collaboration authentication lifecycle passed");
