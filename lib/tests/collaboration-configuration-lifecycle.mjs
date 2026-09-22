import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Window } from "happy-dom";

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
const initialize = new Function(
    "instance",
    "context",
    readFileSync(resolve(root, "src/elements/tiptap-AAC/initialize.js"), "utf8"),
);

async function makeHarness(propertyOverrides = {}) {
    const rootElement = document.createElement("div");
    document.body.appendChild(rootElement);
    const states = new Map();
    const debuggerMessages = [];
    const instance = {
        data: {},
        canvas: {
            css() {},
            append(element) {
                rootElement.appendChild(element);
            },
            parent() {
                return { length: 0 };
            },
            height() {},
        },
        publishState(name, value) {
            states.set(name, value);
        },
        triggerEvent() {},
        publishAutobinding() {},
        canUploadFile() {
            return true;
        },
        uploadFile() {},
    };
    const context = {
        reportDebugger(message) {
            debuggerMessages.push(String(message));
        },
    };
    initialize(instance, context);

    const properties = new Proxy(
        {
            ...defaults,
            initialContent: "<p>Hello</p>",
            content_is_json: false,
            isEditable: true,
            collab_active: false,
            ...propertyOverrides,
            bubble: {
                auto_binding: () => false,
                fit_height: () => false,
                font_size: () => 16,
                font_color: () => "#111111",
                font_face: () => "Arial:400",
            },
        },
        {
            get(target, key) {
                return key in target ? target[key] : undefined;
            },
        },
    );

    instance.data.setupEditor(properties, context);
    await new Promise(resolve => setTimeout(resolve, 30));
    return { instance, states, debuggerMessages, properties, context };
}


const update = new Function("instance", "properties", "context",
    readFileSync(resolve(root, "src/elements/tiptap-AAC/update.js"), "utf8"));
const providers = [];
const RealProvider = window.tiptap.HocuspocusProvider;
class Provider extends RealProvider {
    constructor(options) {
        assert.ok(providers.every(provider => provider.destroyed), "dispose old provider before replacement");
        super({ ...options, connect: false, WebSocketPolyfill: window.WebSocket });
        this.options = options;
        this.destroyed = false;
        providers.push(this);
    }
    destroy() { super.destroy(); this.destroyed = true; }
}
window.tiptap.HocuspocusProvider = Provider;
async function change(h, values) {
    Object.assign(h.properties, values);
    update(h.instance, h.properties, h.context);
    await new Promise(resolve => setTimeout(resolve, 30));
}
const h = await makeHarness({ ext_history: true });
h.instance.data.editor.commands.insertContent("unsaved local text");
const local = h.instance.data.editor;
await change(h, { collab_active: true, collabProvider: "custom", collab_jwt: "token-a",
    collab_url: "wss://example.test", collab_app_id: "app", collab_doc_id: "doc-a" });
assert.notEqual(h.instance.data.editor, local, "entering collaboration must rebuild the schema");
assert.equal(typeof h.instance.data.editor.commands.updateUser, "function");
h.instance.data.provider.options.onSynced();
assert.match(h.instance.data.editor.getText(), /unsaved local text/);
await change(h, { collab_active: false });
assert.equal(providers[0].destroyed, true);
assert.equal(h.instance.data.editor.commands.updateUser, undefined);
assert.match(h.instance.data.editor.getText(), /unsaved local text/);
// Inactive credentials and normalized URL changes are no-ops.
const localAgain = h.instance.data.editor;
await change(h, { collab_jwt: "token-b" });
assert.equal(h.instance.data.editor, localAgain);
await change(h, { collab_active: true });
let current = h.instance.data.provider;
current.options.onSynced();
h.instance.data.editor.commands.insertContent(" pending shared edit");
const draft = h.instance.data.editor.getText();
await change(h, { collab_url: "wss://example.test/" });
assert.equal(h.instance.data.provider, current);
assert.equal(h.properties.collab_url, "wss://example.test/", "setup must not mutate Bubble properties");
// Credential renewal preserves the CRDT, including unsent edits.
await change(h, { collab_jwt: "token-c" });
assert.equal(current.destroyed, true);
assert.equal(h.instance.data.editor.getText(), draft);
const replacement = h.instance.data.provider;
assert.equal(replacement.options.token, "token-c");
const statesBefore = new Map(h.states);
current.options.onSynced();
current.options.onDisconnect();
current.options.onAuthenticationFailed({ reason: "late obsolete callback" });
assert.deepEqual(h.states, statesBefore);
assert.equal(h.instance.data.provider, replacement);
assert.equal(h.instance.data._collabRetryPending, false);
// Cursor name/color updates use the installed command without reconnecting.
// Bubble color fields arrive as rgba(); collaboration-caret accepts hex colors.
await change(h, { collab_user_name: "Ada", collab_cursor_color: "rgba(37, 99, 235, 1)" });
assert.equal(h.instance.data.provider, replacement);
assert.deepEqual(replacement.awareness.getLocalState().user, { name: "Ada", color: "#2563EB" });
// Schema-only rebuilds preserve CRDT state too.
await change(h, { ext_ai_toolkit: true });
assert.equal(h.instance.data.editor.getText(), draft);
// Moving to another room must not seed it with the previous room's draft.
await change(h, { collab_doc_id: "doc-b" });
h.instance.data.provider.options.onSynced();
assert.doesNotMatch(h.instance.data.editor.getText(), /pending shared edit/);
for (const values of [{ collab_url: "wss://other.test" }, { collab_app_id: "other-app" }, { collabProvider: "tiptap" }]) {
    const before = h.instance.data.provider;
    await change(h, values);
    assert.equal(before.destroyed, true);
    assert.notEqual(h.instance.data.provider, before);
}
// Missing credentials immediately disconnect; restoring them resumes setup.
current = h.instance.data.provider;
await change(h, { collab_jwt: "" });
assert.equal(current.destroyed, true);
assert.equal(h.instance.data.editor, null);
assert.equal(h.states.get("collab_status"), "disconnected");
await change(h, { collab_jwt: "restored" });
assert.equal(h.instance.data.editor_is_ready, true);
h.instance.data.editor.commands.insertContent("private room draft");
await change(h, { collab_jwt: "" });
await change(h, { collab_doc_id: "another-room", collab_jwt: "restored" });
h.instance.data.provider.options.onSynced();
assert.doesNotMatch(h.instance.data.editor.getText(), /private room draft/);
// User changes arriving before onCreate use the latest properties.
h.instance.data.teardownEditor("async setup");
h.instance.data.setupEditor(h.properties, h.context);
assert.equal(h.instance.data.editor_is_ready, false);
await change(h, { collab_user_name: "Latest before ready" });
assert.equal(h.instance.data.provider.awareness.getLocalState().user.name, "Latest before ready");
// A pending retry must not resurrect the previous mode or bypass prerequisites.
h.instance.data.editor.commands.insertContent("draft before retry");
const retryDraft = h.instance.data.editor.getText();
const warn = console.warn;
try { console.warn = () => {}; h.instance.data.handleCollabAuthFailure("fixture", "expired"); }
finally { console.warn = warn; }
assert.equal(h.instance.data._collabRetryPending, true);
await change(h, { collab_active: false });
assert.equal(h.instance.data._collabRetryPending, false);
assert.equal(h.instance.data._collabRetryTimer, null);
assert.equal(h.instance.data.editor.commands.updateUser, undefined);
assert.equal(h.instance.data.editor.getText(), retryDraft, "leaving collaboration during backoff preserves visible content");
h.instance.data.teardownEditor("done");
// Liveblocks resources (provider, room and Y.Doc) have explicit ownership.
let leaves = 0;
window.tiptap.createClient = () => ({ enterRoom: () => ({ room: {}, leave: () => { leaves++; } }) });
window.tiptap.LiveblocksProvider = class extends Provider {
    constructor(room, document) { super({ document, url: "wss://unused.test", name: "fixture" }); }
    destroy() { super.destroy(); this.document.destroy(); }
};
const live = await makeHarness({ collab_active: true, collabProvider: "liveblocks", collab_doc_id: "room", liveblocksPublicApiKey: "pk-fixture", collab_jwt: "" });
assert.equal(live.instance.data.editor_is_ready, true, "Liveblocks public key mode does not require a JWT");
live.instance.data.editor.commands.insertContent("Liveblocks draft");
await change(live, { ext_ai_toolkit: true });
assert.equal(leaves, 1);
assert.match(live.instance.data.editor.getText(), /Liveblocks draft/);
await change(live, { liveblocksPublicApiKey: "pk-next" });
assert.equal(leaves, 2);
assert.doesNotMatch(live.instance.data.editor.getText(), /Liveblocks draft/, "new project must not inherit the old room");
live.instance.data.editor.commands.insertContent("new project draft");
await change(live, { collab_active: false });
assert.equal(leaves, 3);
assert.match(live.instance.data.editor.getText(), /new project draft/);
live.instance.data.teardownEditor("done");
console.log("Collaboration configuration lifecycle passed");
