// DEF-1927: the Doc Server ID override.
//
// One Bubble app must be able to use a different Tiptap Cloud (or custom
// Hocuspocus) app id per environment. Bubble copies static field values through a
// Test -> Live merge and offers no runtime "which environment am I in" value, so
// the override arrives through the dynamic field collab_app_id_dynamic. This
// checks the resolution rule everywhere the app id is used: the provider
// construction for both providers, the normalized collaboration configuration
// (which also drives readiness and rebuilds), and the no-behaviour-change case
// where the dynamic field is empty.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Window } from "happy-dom";

const libRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = resolve(libRoot, "..");
const window = new Window({ url: "https://example.test" });
Object.assign(globalThis, {
    window, document: window.document, Node: window.Node, Element: window.Element,
    HTMLElement: window.HTMLElement, ShadowRoot: window.ShadowRoot,
    MutationObserver: window.MutationObserver, DOMParser: window.DOMParser,
    getComputedStyle: window.getComputedStyle.bind(window),
    requestAnimationFrame: callback => setTimeout(() => callback(Date.now()), 0),
    cancelAnimationFrame: clearTimeout,
});
Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true });
await import(pathToFileURL(resolve(libRoot, "dist.js")));

const source = name => readFileSync(resolve(root, `src/elements/tiptap-AAC/${name}.js`), "utf8");
const initialize = new Function("instance", "context", source("initialize"));
const update = new Function("instance", "properties", "context", source("update"));
const metadata = JSON.parse(readFileSync(resolve(root, "src/elements/tiptap-AAC/AAC.json"), "utf8"));
const defaults = Object.fromEntries(Object.values(metadata.fields).map(field => [field.name, field.default_val]));

// The override must stay optional and expression-capable: Bubble rejects
// expressions on static fields, which is the whole reason this field exists.
const override = metadata.fields.AEO;
assert.equal(override.name, "collab_app_id_dynamic");
assert.equal(override.editor, "DynamicValue");
assert.equal(override.value, "text");
assert.equal(override.optional, true);
assert.equal(override.default_val, "");
// Placed directly after the static field it overrides.
const staticField = metadata.fields.AEH;
assert.ok(staticField.editor === "StaticText" && staticField.name === "collab_app_id");
assert.ok(override.rank > staticField.rank);
assert.ok(Object.values(metadata.fields).every(field => !(field.rank > staticField.rank && field.rank < override.rank)));

const providers = [];
const RealProvider = window.tiptap.HocuspocusProvider;
class Provider extends RealProvider {
    constructor(options) {
        // Real provider, no remote connection: the URL is what this test reads.
        super({ ...options, autoConnect: false, WebSocketPolyfill: window.WebSocket });
        this.options = options;
        this.destroyed = false;
        providers.push(this);
    }
    destroy() { super.destroy(); this.destroyed = true; }
}
window.tiptap.HocuspocusProvider = Provider;

async function makeHarness(overrides = {}) {
    const canvas = document.createElement("div");
    document.body.appendChild(canvas);
    const states = new Map(), messages = [];
    const instance = {
        data: {},
        canvas: { css() {}, append: node => canvas.appendChild(node), parent: () => ({ length: 0 }), height() {} },
        publishState: (name, value) => states.set(name, value),
        triggerEvent() {},
        publishAutobinding() {},
        canUploadFile: () => true,
        uploadFile() {},
    };
    const context = { reportDebugger: message => messages.push(String(message)) };
    initialize(instance, context);
    const properties = {
        ...defaults,
        initialContent: "<p>Seed</p>", content_is_json: false, isEditable: true,
        collab_active: true, collabProvider: "tiptap", collab_app_id: "static-app",
        collab_doc_id: "doc-fixture", collab_jwt: "token-fixture",
        ...overrides,
        bubble: {
            auto_binding: () => false, fit_height: () => false, font_size: () => 16,
            font_color: () => "#111111", font_face: () => "Arial:400",
        },
    };
    const h = {
        instance, properties, states, messages,
        async change(values = {}) {
            Object.assign(properties, values);
            update(instance, properties, context);
            await new Promise(done => setTimeout(done, 30));
        },
    };
    instance.data.setupEditor(properties, context);
    await new Promise(done => setTimeout(done, 30));
    return h;
}

const url = h => h.instance.data.provider.options.url;

// Only the static field: unchanged behaviour, and the static id reaches the URL.
const tiptap = await makeHarness();
assert.equal(url(tiptap), "wss://static-app.collab.tiptap.cloud");
assert.equal(tiptap.instance.data.collaborationAppId(tiptap.properties), "static-app");
assert.equal(tiptap.instance.data.collaborationConfiguration(tiptap.properties).app, "static-app");

// A non-empty dynamic value wins, without touching the static field.
await tiptap.change({ collab_app_id_dynamic: "e97r1ejm" });
assert.equal(url(tiptap), "wss://e97r1ejm.collab.tiptap.cloud");
assert.equal(tiptap.properties.collab_app_id, "static-app");
assert.equal(tiptap.instance.data.collaborationConfiguration(tiptap.properties).app, "e97r1ejm");

// A masked static change is a no-op.
const maskedProvider = tiptap.instance.data.provider;
await tiptap.change({ collab_app_id: "masked-static" });
assert.equal(tiptap.instance.data.provider, maskedProvider);
await tiptap.change({ collab_app_id: "static-app" });
assert.equal(tiptap.instance.data.provider, maskedProvider);

// Switching environments at runtime rebuilds onto the new app id, without
// carrying the old server's unsaved draft across the destination boundary.
tiptap.instance.data.provider.options.onSynced();
tiptap.instance.data.editor.commands.insertContent("old-server-private-draft");
const before = tiptap.instance.data.provider;
await tiptap.change({ collab_app_id_dynamic: "29qn2129" });
assert.equal(before.destroyed, true);
assert.notEqual(tiptap.instance.data.provider, before);
assert.equal(url(tiptap), "wss://29qn2129.collab.tiptap.cloud");
tiptap.instance.data.provider.options.onSynced();
assert.doesNotMatch(tiptap.instance.data.editor.getText(), /old-server-private-draft/);
assert.equal(tiptap.instance.data.collaborationAppId({ collab_app_id: "legacy" }), "legacy");

// Empty and whitespace-only dynamic values fall back to the static id.
for (const value of ["", "   "]) {
    await tiptap.change({ collab_app_id_dynamic: value });
    assert.equal(url(tiptap), "wss://static-app.collab.tiptap.cloud", `dynamic ${JSON.stringify(value)} must not win`);
}
// Surrounding whitespace in a real id is trimmed rather than sent to the host.
await tiptap.change({ collab_app_id_dynamic: "  spaced-app \n" });
assert.equal(url(tiptap), "wss://spaced-app.collab.tiptap.cloud");

// The custom provider appends the same resolved id to the base URL.
const custom = await makeHarness({ collabProvider: "custom", collab_url: "wss://example.test/", collab_doc_id: "doc-custom" });
assert.equal(url(custom), "wss://example.test/static-app");
await custom.change({ collab_app_id_dynamic: "custom-override" });
assert.equal(url(custom), "wss://example.test/custom-override");
assert.equal(custom.instance.data.collaborationConfiguration(custom.properties).app, "custom-override");

// A dynamic-only element (no static value) is ready and connects, where before
// it could never be configured at all.
const dynamicOnly = await makeHarness({ collab_app_id: "", collab_app_id_dynamic: "dynamic-only" });
assert.equal(url(dynamicOnly), "wss://dynamic-only.collab.tiptap.cloud");
assert.equal(dynamicOnly.instance.data.editor_is_ready, true);
// Liveblocks ignores the app id entirely, without opening a Liveblocks connection.
assert.equal(dynamicOnly.instance.data.collaborationConfiguration({
    ...dynamicOnly.properties, collabProvider: "liveblocks",
}).app, "");

for (const h of [tiptap, custom, dynamicOnly]) h.instance.data.teardownEditor("test complete");
await window.happyDOM.abort();
console.log("Doc Server ID override tests passed");
