import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Window } from "happy-dom";

// WTF-250: a failed editor setup must leave no partial resources behind, report
// one stable setup error, and not retry an unchanged configuration on every
// Bubble update. Runs the real decoded initialize/update/reset source and bundle.

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
const initialize = new Function("instance", "context", source("initialize"));
const update = new Function("instance", "properties", "context", source("update"));
const reset = new Function("instance", "context", source("reset"));
const metadata = JSON.parse(readFileSync(resolve(root, "src/elements/tiptap-AAC/AAC.json"), "utf8"));
const defaults = Object.fromEntries(Object.values(metadata.fields).map(field => [field.name, field.default_val]));
assert.ok(Object.values(metadata.states).some(state => state.name === "setup_error" && state.value === "text"),
    "setup_error must be a declared text state");

// Failure injection around the real runtime exports.
const tiptap = window.tiptap;
const real = { Editor: tiptap.Editor, HocuspocusProvider: tiptap.HocuspocusProvider, FloatingMenu: tiptap.FloatingMenu,
    createClient: tiptap.createClient, LiveblocksProvider: tiptap.LiveblocksProvider };
let editorConstructions = 0;
let failEditor = false;
tiptap.Editor = class extends real.Editor {
    constructor(options) {
        editorConstructions++;
        if (failEditor) throw new Error("injected editor failure");
        super(options);
    }
};
const providers = [];
tiptap.HocuspocusProvider = class extends real.HocuspocusProvider {
    constructor(options) {
        super({ ...options, autoConnect: false, WebSocketPolyfill: window.WebSocket });
        this.destroyCalls = 0;
        this.documentDestroyed = false;
        this.document.on("destroy", () => { this.documentDestroyed = true; });
        providers.push(this);
    }
    destroy() {
        this.destroyCalls++;
        super.destroy();
    }
};

async function makeHarness(overrides = {}, { attached = true } = {}) {
    const canvas = document.createElement("div");
    if (attached) document.body.appendChild(canvas);
    const states = new Map(), messages = [];
    const instance = {
        data: {},
        canvas: { 0: canvas, css() {}, append: node => canvas.appendChild(node), parent: () => ({ length: 0 }), height() {} },
        publishState: (name, value) => states.set(name, value), triggerEvent() {},
        publishAutobinding() {}, canUploadFile: () => true, uploadFile() {},
    };
    const context = { reportDebugger: message => messages.push(String(message)) };
    initialize(instance, context);
    const properties = {
        ...defaults, initialContent: "<p>Seed</p>", content_is_json: false, isEditable: true, collab_active: false,
        ...overrides,
        bubble: { auto_binding: () => false, fit_height: () => false, font_size: () => 16,
            font_color: () => "#111111", font_face: () => "Arial:400" },
    };
    const h = {
        instance, properties, states, messages, canvas, context,
        async change(values = {}) {
            Object.assign(properties, values);
            update(instance, properties, context);
            await window.happyDOM.whenAsyncComplete();
        },
        close() { instance.data.teardownEditor("test complete"); canvas.remove(); },
    };
    await h.change();
    return h;
}

function makeMenu(id) {
    const parent = document.createElement("section");
    const node = document.createElement("div");
    const sibling = document.createElement("span");
    node.id = id;
    node.setAttribute("style", "color: red;");
    parent.append(node, sibling);
    document.body.append(parent);
    return {
        node,
        restored() {
            return node.parentNode === parent && node.nextSibling === sibling &&
                node.getAttribute("style") === "color: red;" && parent.childNodes.length === 2;
        },
        remove() { parent.remove(); },
    };
}

const wrappers = h => h.canvas.querySelectorAll('[id^="tiptapEditor-"]').length;

function assertFailedCleanly(h, label) {
    assert.equal(wrappers(h), 0, `${label}: no orphan editor wrapper`);
    assert.equal(h.instance.data.editor ?? null, null, `${label}: no editor`);
    assert.equal(h.instance.data.provider ?? null, null, `${label}: no provider`);
    assert.equal(h.instance.data._collabDocument ?? null, null, `${label}: no active Y.Doc`);
    assert.equal(h.instance.data._menuLeases.length, 0, `${label}: no menu leases`);
    assert.equal(h.instance.data.isEditorSetup, false, `${label}: not set up`);
    assert.notEqual(h.states.get("is_ready"), true, `${label}: not ready`);
    assert.ok(h.states.get("setup_error"), `${label}: publishes a setup error`);
}

// 1. Invalid UniqueID configuration is rejected before any side effect, and
//    repeated Bubble updates neither append wrappers nor re-report.
for (const types of ["", " , "]) {
    const bubble = makeMenu(`unique-bubble-${types.length}`);
    const h = await makeHarness({ ext_uniqueid: true, extension_uniqueid_types: types,
        ext_bubblemenu: true, bubbleMenu: bubble.node.id });
    assertFailedCleanly(h, `UniqueID types "${types}"`);
    assert.ok(bubble.restored(), "menu is never acquired for invalid configuration");
    const error = h.states.get("setup_error");
    assert.match(error, /UniqueID/);
    const generation = h.instance.data._collabGeneration;
    for (let i = 0; i < 3; i++) await h.change();
    assertFailedCleanly(h, "unchanged invalid updates");
    assert.equal(h.messages.filter(message => message.includes("UniqueID")).length, 1, "reported once");
    assert.equal(h.states.get("setup_error"), error, "stable error");
    assert.equal(h.instance.data._collabGeneration, generation, "validation failure has no lifecycle side effects");
    await h.change({ extension_uniqueid_types: "paragraph, heading" });
    assert.equal(h.states.get("is_ready"), true, "fixed configuration recovers");
    assert.equal(wrappers(h), 1);
    assert.equal(h.states.get("setup_error"), "", "success clears the setup error");
    h.close();
    assert.ok(bubble.restored());
    bubble.remove();
}

// 2. Invalid JSON initial content is a setup error, not an exception out of update().
{
    const h = await makeHarness({ content_is_json: true, initialContent: "{not json" });
    assertFailedCleanly(h, "invalid JSON");
    assert.match(h.states.get("setup_error"), /JSON/);
    await h.change();
    assert.equal(h.messages.filter(message => message.includes("JSON")).length, 1);
    await h.change({ initialContent: JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Parsed" }] }] }) });
    assert.equal(h.states.get("is_ready"), true);
    assert.equal(h.instance.data.editor.getText(), "Parsed");
    h.close();
}

// 3. Construction failure after menus and a collaboration provider were staged
//    rolls every resource back, including with a detached Bubble canvas.
for (const attached of [true, false]) {
    const bubble = makeMenu(`ctor-bubble-${attached}`);
    const floating = makeMenu(`ctor-floating-${attached}`);
    failEditor = true;
    const before = editorConstructions;
    const h = await makeHarness({
        collab_active: true, collabProvider: "custom", collab_url: "wss://example.test", collab_app_id: "app",
        collab_doc_id: "doc", collab_jwt: "token",
        ext_bubblemenu: true, bubbleMenu: bubble.node.id, ext_floatingmenu: true, floatingMenu: floating.node.id,
    }, { attached });
    const provider = providers.at(-1);
    assert.equal(editorConstructions, before + 1);
    assertFailedCleanly(h, `constructor failure (attached ${attached})`);
    assert.equal(provider.destroyCalls, 1, "staged provider destroyed");
    assert.equal(provider.documentDestroyed, true, "staged Y.Doc destroyed");
    if (attached) assert.ok(bubble.restored() && floating.restored(), "menus restored");
    const error = h.states.get("setup_error");
    for (let i = 0; i < 3; i++) await h.change();
    assert.equal(editorConstructions, before + 1, "unchanged failed configuration is not retried");
    assert.equal(providers.at(-1), provider, "no provider per update");
    assert.equal(h.states.get("setup_error"), error);
    assert.equal(h.messages.filter(message => message.includes("could not be created")).length, 1, "reported once");
    await h.change({ placeholder: "changed" });
    assert.equal(editorConstructions, before + 2, "changed configuration retries");
    assertFailedCleanly(h, "changed but still failing");
    failEditor = false;
    await h.change({ placeholder: "fixed" });
    assert.equal(h.instance.data.isEditorSetup, true);
    assert.equal(h.states.get("setup_error"), "");
    h.close();
    assert.equal(wrappers(h), 0);
    if (attached) assert.ok(bubble.restored() && floating.restored());
    bubble.remove();
    floating.remove();
}

// 4. Menu configuration failure after another menu was acquired releases it.
{
    const bubble = makeMenu("menu-fail-bubble");
    const floating = makeMenu("menu-fail-floating");
    tiptap.FloatingMenu = { configure() { throw new Error("injected menu failure"); } };
    const h = await makeHarness({ ext_bubblemenu: true, bubbleMenu: bubble.node.id,
        ext_floatingmenu: true, floatingMenu: floating.node.id });
    tiptap.FloatingMenu = real.FloatingMenu;
    assertFailedCleanly(h, "menu configuration failure");
    assert.ok(bubble.restored() && floating.restored(), "acquired menus restored");
    h.close();
    bubble.remove();
    floating.remove();
}

// 5. Liveblocks: a room entered before provider construction fails is left.
{
    let leaves = 0;
    tiptap.createClient = () => ({ enterRoom: () => ({ room: {}, leave: () => leaves++ }) });
    tiptap.LiveblocksProvider = class { constructor() { throw new Error("injected Liveblocks failure"); } };
    const h = await makeHarness({ collab_active: true, collabProvider: "liveblocks",
        liveblocksPublicApiKey: "pk_test", collab_doc_id: "room" });
    tiptap.createClient = real.createClient;
    tiptap.LiveblocksProvider = real.LiveblocksProvider;
    assertFailedCleanly(h, "Liveblocks provider failure");
    assert.equal(leaves, 1, "room left exactly once");
    h.close();
    assert.equal(leaves, 1);
}

// 6. A failed rebuild keeps the unsaved local document for the next attempt.
{
    const h = await makeHarness();
    h.instance.data.editor.commands.setContent("<p>Unsaved edit</p>");
    failEditor = true;
    await h.change({ ext_find_replace: !h.properties.ext_find_replace });
    assertFailedCleanly(h, "failed rebuild");
    failEditor = false;
    await h.change({ placeholder: "retry" });
    assert.equal(h.states.get("is_ready"), true);
    assert.equal(h.instance.data.editor.getText(), "Unsaved edit", "rebuild snapshot survives the failed attempt");
    h.close();
}

// 7. Provider construction failure after menus and the Y.Doc were staged.
{
    const bubble = makeMenu("provider-fail-bubble");
    const TestProvider = tiptap.HocuspocusProvider;
    let documentDestroyed = null;
    tiptap.HocuspocusProvider = class {
        constructor(options) {
            documentDestroyed = false;
            options.document.on("destroy", () => { documentDestroyed = true; });
            throw new Error("injected provider failure");
        }
    };
    const h = await makeHarness({ collab_active: true, collabProvider: "tiptap", collab_app_id: "app",
        collab_doc_id: "doc", collab_jwt: "token", ext_bubblemenu: true, bubbleMenu: bubble.node.id });
    tiptap.HocuspocusProvider = TestProvider;
    assertFailedCleanly(h, "provider constructor failure");
    assert.equal(documentDestroyed, true, "staged Y.Doc destroyed");
    assert.ok(bubble.restored());
    h.close();
    bubble.remove();
}

// 8. A failed collaborative rebuild keeps the shared document's unsent state.
{
    const h = await makeHarness({ collab_active: true, collabProvider: "custom", collab_url: "wss://example.test",
        collab_app_id: "app", collab_doc_id: "shared", collab_jwt: "token" });
    assert.equal(h.states.get("is_ready"), true);
    h.instance.data.editor.commands.setContent("<p>Unsent collaborative edit</p>");
    failEditor = true;
    await h.change({ ext_find_replace: !h.properties.ext_find_replace });
    assertFailedCleanly(h, "failed collaborative rebuild");
    assert.ok(h.instance.data._pendingCollabDocument, "CRDT state kept for the next attempt");
    failEditor = false;
    await h.change({ placeholder: "retry collaborative" });
    assert.equal(h.states.get("is_ready"), true);
    assert.equal(h.instance.data.editor.getText(), "Unsent collaborative edit");
    h.close();
}

// 9. Bubble signals a list that is still loading by throwing out of update()
//    and re-running it later. That must escape before any side effect and must
//    not latch a setup failure; a changed list is a changed configuration.
{
    let loaded = false;
    const types = ["image/png"];
    const allowedMimeTypes = {
        length() { if (!loaded) throw new Error("not ready"); return types.length; },
        get(start, length) { if (!loaded) throw new Error("not ready"); return types.slice(start, start + length); },
    };
    let h;
    await assert.rejects(makeHarness({ allowedMimeTypes }), /not ready/, "not-ready escapes update()");
    const canvases = document.body.querySelectorAll('[id^="tiptapEditor-"]').length;
    loaded = true;
    h = await makeHarness({ allowedMimeTypes });
    assert.equal(h.states.get("is_ready"), true);
    assert.equal(document.body.querySelectorAll('[id^="tiptapEditor-"]').length, canvases + 1);
    h.close();

    // A loading list on a harness that already has state: nothing staged, no latch.
    loaded = true;
    h = await makeHarness({ ext_uniqueid: true, extension_uniqueid_types: "", allowedMimeTypes });
    assert.ok(h.states.get("setup_error"));
    loaded = false;
    assert.throws(() => update(h.instance, h.properties, h.context), /not ready/);
    assert.equal(wrappers(h), 0);
    loaded = true;
    const failure = h.instance.data._setupFailure;
    types.push("image/jpeg");
    await h.change();
    assert.notEqual(h.instance.data._setupFailure, failure, "changed list contents retry validation");
    await h.change({ extension_uniqueid_types: "paragraph" });
    assert.equal(h.states.get("is_ready"), true);
    h.close();
}

// 10. Setup that is skipped (collaboration not ready) does not keep showing an
//     earlier configuration's error.
{
    const h = await makeHarness({ content_is_json: true, initialContent: "{bad" });
    assert.ok(h.states.get("setup_error"));
    await h.change({ collab_active: true, collabProvider: "custom", collab_url: "", collab_doc_id: "doc", collab_jwt: "" });
    assert.equal(h.states.get("setup_error"), "", "no stale error while setup waits for collaboration settings");
    h.close();
}

// 11. An explicit element reset retries an unchanged failed configuration.
{
    failEditor = true;
    const before = editorConstructions;
    const h = await makeHarness();
    await h.change();
    assert.equal(editorConstructions, before + 1);
    failEditor = false;
    reset(h.instance, h.context);
    await h.change();
    assert.equal(editorConstructions, before + 2, "reset clears the failure latch");
    assert.equal(h.states.get("is_ready"), true);
    assert.equal(h.states.get("setup_error"), "");
    h.close();
}

console.log("Setup failure atomicity passed");
