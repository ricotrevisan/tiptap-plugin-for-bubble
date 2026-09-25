import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Window } from "happy-dom";

// WTF-263: the behavior docs/recipes.md promises for each document owner.
// Runs the real plugin lifecycle (initialize.js + update.js + dist.js).

const libRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = resolve(libRoot, "..");
const window = new Window({ url: "https://example.test" });

Object.assign(globalThis, {
    window,
    document: window.document,
    Node: window.Node,
    HTMLElement: window.HTMLElement,
    ShadowRoot: window.ShadowRoot,
    MutationObserver: window.MutationObserver,
    DOMParser: window.DOMParser,
    getComputedStyle: window.getComputedStyle.bind(window),
    requestAnimationFrame: (callback) => setTimeout(() => callback(Date.now()), 0),
    cancelAnimationFrame: (handle) => clearTimeout(handle),
});
Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true });

await import(pathToFileURL(resolve(libRoot, "dist.js")));

const metadata = JSON.parse(readFileSync(resolve(root, "src/elements/tiptap-AAC/AAC.json"), "utf8"));
const defaults = Object.fromEntries(Object.values(metadata.fields).map((field) => [field.name, field.default_val]));
const initializeSource = readFileSync(resolve(root, "src/elements/tiptap-AAC/initialize.js"), "utf8");
const update = new Function("instance", "properties", "context",
    readFileSync(resolve(root, "src/elements/tiptap-AAC/update.js"), "utf8"));

// Keep providers offline; tests drive sync and remote edits through the Y.Doc.
const RealProvider = window.tiptap.HocuspocusProvider;
window.tiptap.HocuspocusProvider = class extends RealProvider {
    constructor(options) {
        super({ ...options, connect: false, WebSocketPolyfill: window.WebSocket });
        this.options = options;
    }
};

const settle = () => new Promise((resolve_) => setTimeout(resolve_, 30));

async function makeHarness(overrides = {}, { autoBinding = false } = {}) {
    const rootElement = document.createElement("div");
    document.body.appendChild(rootElement);
    const states = new Map();
    const events = [];
    const writes = [];
    const debuggerMessages = [];
    let now = 0, sequence = 0;
    const timers = new Map();
    const schedule = (callback, delay) => { const id = ++sequence; timers.set(id, { callback, at: now + delay }); return id; };
    const cancel = (id) => timers.delete(id);
    const advance = (ms) => {
        now += ms;
        for (const [id, timer] of [...timers]) if (timer.at <= now && timers.delete(id)) timer.callback();
    };
    const instance = {
        data: {},
        canvas: {
            0: rootElement,
            css() {},
            append(element) { rootElement.appendChild(element); },
            parent() { return { length: 0 }; },
            height() {},
        },
        publishState(name, value) { states.set(name, value); },
        triggerEvent(name) { events.push(name); },
        publishAutobinding(content) { writes.push(content); },
        canUploadFile() { return true; },
        uploadFile() {},
    };
    const context = { reportDebugger(message) { debuggerMessages.push(String(message)); } };
    new Function("instance", "context", "setTimeout", "clearTimeout", initializeSource)(instance, context, schedule, cancel);
    const properties = new Proxy({
        ...defaults,
        ext_table_of_contents: false,
        update_delay: 300,
        autobinding_save_delay: 2200,
        initialContent: "<p>Saved text</p>",
        autobinding: autoBinding ? "<p>Saved text</p>" : "",
        content_is_json: false,
        isEditable: true,
        collab_active: false,
        ...overrides,
        bubble: {
            auto_binding: () => autoBinding,
            fit_height: () => false,
            font_size: () => 16,
            font_color: () => "#111111",
            font_face: () => "Arial:400",
        },
    }, { get(target, key) { return key in target ? target[key] : undefined; } });
    update(instance, properties, context);
    await settle();
    const h = { instance, properties, context, states, events, writes, debuggerMessages, advance };
    h.editor = () => instance.data.editor;
    h.change = async (values) => { Object.assign(properties, values); update(instance, properties, context); await settle(); };
    h.type = (text) => h.editor().commands.insertContentAt(h.editor().state.doc.content.size - 1, text);
    h.count = (name) => events.filter((event) => event === name).length;
    h.close = () => { instance.data.teardownEditor("test"); rootElement.remove(); };
    return h;
}

const results = [];
async function scenario(name, run) {
    try {
        await run();
        results.push(["PASS", name]);
    } catch (error) {
        results.push(["FAIL", name]);
        console.error(error);
    }
}

await scenario("save button: Content updated fires once after Update delay, nothing is autobound", async () => {
    const h = await makeHarness();
    h.events.length = 0;
    h.type(" one");
    h.type(" two");
    h.advance(299);
    assert.equal(h.count("contentUpdated"), 0, "waits for Update delay");
    h.advance(1);
    assert.equal(h.count("contentUpdated"), 1, "one event after the typing pause");
    assert.equal(h.states.get("contentHTML"), "<p>Saved text one two</p>");
    assert.deepEqual(h.writes, [], "no autobinding writes without autobinding");
    h.close();
});

await scenario("save button: the saved value coming back as Initial content keeps the text", async () => {
    const h = await makeHarness();
    h.type(" edited");
    h.advance(300);
    const saved = h.states.get("contentHTML");
    h.events.length = 0;
    await h.change({ initialContent: saved });
    assert.equal(h.editor().getHTML(), saved);
    await h.change({ initialContent: "<p>Changed elsewhere</p>" });
    assert.equal(h.editor().getHTML(), "<p>Changed elsewhere</p>", "a different Initial content replaces the text");
    h.close();
});

await scenario("read-only view: not editable and follows Initial content", async () => {
    const h = await makeHarness({ isEditable: false, initialContent: "<h2>Note A</h2><p>First</p>" });
    assert.equal(h.editor().isEditable, false);
    assert.equal(h.states.get("isEditable"), false);
    await h.change({ initialContent: "<h2>Note A</h2><p>Saved again</p>" });
    assert.equal(h.editor().getHTML(), "<h2>Note A</h2><p>Saved again</p>");
    assert.equal(h.editor().isEditable, false, "new content stays read-only");
    await h.change({ isEditable: true });
    assert.equal(h.editor().isEditable, true, "This input is enabled can be switched at run time");
    h.close();
});

const collaboration = {
    collab_active: true,
    collabProvider: "tiptap",
    collab_app_id: "app",
    collab_doc_id: "doc-a",
    collab_jwt: "token",
};

await scenario("collaboration waits for a token, then starts", async () => {
    const h = await makeHarness({ ...collaboration, collab_jwt: "" });
    assert.equal(h.editor(), undefined, "no editor before the JWT key arrives");
    assert.equal(h.states.get("is_ready"), false);
    assert.ok(h.debuggerMessages.some((message) => /waiting for .*credentials/.test(message)));
    await h.change({ collab_jwt: "token" });
    assert.ok(h.editor(), "the editor starts once the token is set");
    assert.equal(h.states.get("is_ready"), true);
    h.close();
});

await scenario("collaboration owns the document: autobinding is ignored", async () => {
    const h = await makeHarness(collaboration, { autoBinding: true });
    h.instance.data.provider.options.onSynced();
    assert.ok(h.debuggerMessages.some((message) => /Auto-binding will be ignored/.test(message)));
    h.type(" shared edit");
    h.advance(5000);
    assert.deepEqual(h.writes, [], "no autobinding writes while collaborating");
    await h.change({ autobinding: "<p>Stale database copy</p>" });
    assert.match(h.editor().getText(), /shared edit/, "database value does not replace the shared document");
    assert.doesNotMatch(h.editor().getText(), /Stale database copy/);
    h.close();
});

await scenario("collaboration: Content updated fires on every change, local and remote", async () => {
    const h = await makeHarness(collaboration);
    h.instance.data.provider.options.onSynced();
    h.events.length = 0;
    h.type("a");
    h.type("b");
    assert.equal(h.count("contentUpdated"), 2, "no Update delay while collaborating");

    const { Y } = window.tiptap;
    const peer = new Y.Doc();
    Y.applyUpdate(peer, Y.encodeStateAsUpdate(h.instance.data._collabDocument));
    const paragraph = new Y.XmlElement("paragraph");
    paragraph.insert(0, [new Y.XmlText("From a collaborator")]);
    peer.getXmlFragment("default").push([paragraph]);
    Y.applyUpdate(h.instance.data._collabDocument, Y.encodeStateAsUpdate(peer));
    await settle();
    assert.match(h.editor().getText(), /From a collaborator/);
    assert.equal(h.count("contentUpdated"), 3, "a collaborator's edit also fires Content updated");
    assert.match(h.states.get("contentHTML"), /From a collaborator/, "Content (HTML) is the shared document");
    h.close();
});

for (const [status, name] of results) console.log(`${status} ${name}`);
assert.ok(results.every(([status]) => status === "PASS"), "document ownership scenarios failed");
