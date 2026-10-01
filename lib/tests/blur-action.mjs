import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Window } from "happy-dom";

// DEF-1927: the Blur action removes focus from the editor without changing
// content or selection, so the isn't focused event and is focused state follow.

const libRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = resolve(libRoot, "..");
const window = new Window({ url: "https://example.test" });
Object.assign(globalThis, {
    window, document: window.document, Node: window.Node, HTMLElement: window.HTMLElement,
    ShadowRoot: window.ShadowRoot, MutationObserver: window.MutationObserver, DOMParser: window.DOMParser,
    getComputedStyle: window.getComputedStyle.bind(window),
    requestAnimationFrame: callback => setTimeout(() => callback(Date.now()), 0),
    cancelAnimationFrame: clearTimeout,
});
Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true });
await import(pathToFileURL(resolve(libRoot, "dist.js")));

const elementRoot = resolve(root, "src/elements/tiptap-AAC");
const source = name => readFileSync(resolve(elementRoot, `${name}.js`), "utf8");
const initialize = new Function("instance", "context", source("initialize"));
const actionFile = "actions/blur-blur";
assert.ok(existsSync(resolve(elementRoot, `${actionFile}.js`)), "Blur action file exists");
const blur = new Function("instance", "properties", "context", source(actionFile));
const metadata = JSON.parse(readFileSync(resolve(elementRoot, "AAC.json"), "utf8"));
const defaults = Object.fromEntries(Object.values(metadata.fields).map(field => [field.name, field.default_val]));

assert.equal(metadata.actions.blur?.caption, "Blur");
assert.equal(metadata.actions.blur.fields, undefined, "Blur takes no fields");

async function makeHarness(overrides = {}) {
    const rootElement = document.createElement("div");
    document.body.appendChild(rootElement);
    const reports = [];
    const states = new Map();
    const events = [];
    const instance = {
        data: {},
        canvas: { css() {}, append(element) { rootElement.appendChild(element); }, parent() { return { length: 0 }; }, height() {} },
        publishState(name, value) { states.set(name, value); }, triggerEvent(name) { events.push(name); }, publishAutobinding() {},
        canUploadFile() { return true; }, uploadFile() {},
    };
    const context = { reportDebugger(message) { reports.push(message); } };
    initialize(instance, context);
    const properties = new Proxy({
        ...defaults,
        initialContent: '<p><strong><mark data-color="#ffcc00" style="background-color: #ffcc00; color: inherit">Bold highlighted</mark></strong> <em><mark>italic highlighted</mark></em> <mark>untouched</mark></p>',
        content_is_json: false, isEditable: true, collab_active: false, ...overrides,
        bubble: { auto_binding: () => false, fit_height: () => false, font_size: () => 16, font_color: () => "#111111", font_face: () => "Arial:400" },
    }, { get: (target, key) => key in target ? target[key] : undefined });
    instance.data.setupEditor(properties, context);
    await window.happyDOM.whenAsyncComplete();
    return { instance, context, reports, states, events };
}

// Blur on a focused editor: isn't focused fires, is focused becomes no,
// content and selection stay.
{
    const h = await makeHarness();
    const editor = h.instance.data.editor;
    editor.chain().focus().setTextSelection({ from: 2, to: 6 }).run();
    await window.happyDOM.whenAsyncComplete();
    assert.equal(editor.isFocused, true);
    assert.equal(h.states.get("isFocused"), true);
    const html = editor.getHTML();
    h.events.length = 0;
    blur(h.instance, {}, h.context);
    await window.happyDOM.whenAsyncComplete();
    assert.equal(editor.isFocused, false);
    assert.equal(h.states.get("isFocused"), false);
    assert.deepEqual(h.events.filter(name => name === "isntFocused"), ["isntFocused"]);
    assert.equal(editor.getHTML(), html);
    assert.deepEqual([editor.state.selection.from, editor.state.selection.to], [2, 6]);
    assert.equal(h.reports.length, 0);
    h.instance.data.teardownEditor("test");
}

// Editor not ready: the action reports instead of throwing.
{
    const h = await makeHarness();
    h.instance.data.teardownEditor("test");
    h.instance.data.editor_is_ready = false;
    blur(h.instance, {}, h.context);
    assert.match(h.reports.at(-1), /Tried to run Blur before editor was ready/);
}

console.log(JSON.stringify({ blurs: true, firesIsntFocused: true, keepsContentAndSelection: true, guardsReady: true }));
