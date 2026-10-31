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
    const writes = [];
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
        publishAutobinding(content) { writes.push(content); },
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
                auto_binding: () => !!propertyOverrides.autoBinding,
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
    return { instance, states, debuggerMessages, writes, properties, context };
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

// DEF-2252: a local <-> shared switch that happens together with a record
// change must not seed the new shared document with the previous record.
const goalHtml = "<p>GOAL UPDATE: Apollo Tires</p>";
const issueHtml = "<p>ISSUE: Team stretched too thin</p>";
const shared = { collab_active: true, collabProvider: "custom", collab_jwt: "token",
    collab_url: "wss://example.test", collab_app_id: "app" };
async function synced(h) {
    h.instance.data.provider.options.onSynced();
    await new Promise(resolve => setTimeout(resolve, 30));
    return h.instance.data.editor.getText();
    h.instance.data.teardownEditor("test done");
}

// 1. Local record A becomes shared record B in one update.
{
    const h = await makeHarness({ initialContent: goalHtml });
    await change(h, { ...shared, collab_doc_id: "ws.issue.issue", initialContent: issueHtml });
    assert.match(await synced(h), /ISSUE/, "local A -> shared B seeds B from B's initialContent");
    assert.doesNotMatch(h.instance.data.editor.getText(), /GOAL/);
    h.instance.data.teardownEditor("test done");
}

// 2. Shared A -> local (empty record) -> shared B.
{
    const h = await makeHarness({ initialContent: goalHtml, ...shared, collab_doc_id: "ws.update.goal" });
    await synced(h);
    await change(h, { collab_active: false, initialContent: "<p></p>" });
    assert.doesNotMatch(h.instance.data.editor.getText(), /GOAL/, "the empty interlude must not keep A's text");
    await change(h, { ...shared, collab_doc_id: "ws.issue.issue", initialContent: issueHtml });
    assert.match(await synced(h), /ISSUE/, "shared A -> local -> shared B seeds B from B's initialContent");
    h.instance.data.teardownEditor("test done");
}

// 3. Shared A -> local A (same initialContent) -> shared B with the same initialContent.
{
    const h = await makeHarness({ initialContent: "<p></p>", ...shared, collab_doc_id: "ws.a.issue" });
    h.instance.data.provider.options.onSynced();
    h.instance.data.editor.commands.insertContent("text typed in A");
    await change(h, { collab_active: false });
    assert.match(h.instance.data.editor.getText(), /text typed in A/, "shared -> local keeps the same record's text");
    await change(h, { ...shared, collab_doc_id: "ws.b.issue" });
    assert.doesNotMatch(await synced(h), /text typed in A/, "another document is never seeded with A's text");
    h.instance.data.teardownEditor("test done");
}

// 4. Same record: unsaved local edits still seed its empty shared document.
{
    const h = await makeHarness({ initialContent: issueHtml });
    h.instance.data.editor.commands.insertContent("unsaved local text ");
    await change(h, { ...shared, collab_doc_id: "ws.issue.issue" });
    assert.match(await synced(h), /unsaved local text/, "local -> shared for the same record keeps local edits");
    h.instance.data.teardownEditor("test done");
}

// 5. Shared A -> local -> shared A keeps the visible content.
{
    const h = await makeHarness({ initialContent: issueHtml, ...shared, collab_doc_id: "ws.issue.issue" });
    await synced(h);
    await change(h, { collab_active: false });
    assert.match(h.instance.data.editor.getText(), /ISSUE/);
    await change(h, { ...shared, collab_doc_id: "ws.issue.issue" });
    assert.match(await synced(h), /ISSUE/);
    h.instance.data.teardownEditor("test done");
}

console.log("collaboration record switch: ok");
process.exit(0);
