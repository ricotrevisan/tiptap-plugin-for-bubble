import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Window } from "happy-dom";

// DEF-1927: the Clear Highlight action removes highlight from the selection
// only, keeps every other mark, and is guarded like the other actions.

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
const actionFile = "actions/clear-highlight-clear_highlight";
assert.ok(existsSync(resolve(elementRoot, `${actionFile}.js`)), "Clear Highlight action file exists");
const clearHighlight = new Function("instance", "properties", "context", source(actionFile));
const metadata = JSON.parse(readFileSync(resolve(elementRoot, "AAC.json"), "utf8"));
const defaults = Object.fromEntries(Object.values(metadata.fields).map(field => [field.name, field.default_val]));

assert.equal(metadata.actions.clear_highlight?.caption, "Clear Highlight");
assert.equal(metadata.actions.clear_highlight.fields, undefined, "Clear Highlight takes no fields");

async function makeHarness(overrides = {}) {
    const rootElement = document.createElement("div");
    document.body.appendChild(rootElement);
    const reports = [];
    const instance = {
        data: {},
        canvas: { css() {}, append(element) { rootElement.appendChild(element); }, parent() { return { length: 0 }; }, height() {} },
        publishState() {}, triggerEvent() {}, publishAutobinding() {},
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
    return { instance, context, reports };
}

const marksAt = (editor, text) => {
    let names;
    editor.state.doc.descendants((node) => {
        if (node.isText && node.text.includes(text)) names = node.marks.map(mark => mark.type.name).sort();
    });
    return names;
};
const rangeOf = (editor, text) => {
    let range;
    editor.state.doc.descendants((node, pos) => {
        if (node.isText && node.text.includes(text)) {
            const from = pos + node.text.indexOf(text);
            range = { from, to: from + text.length };
        }
    });
    return range;
};

// Clearing a selection removes only highlight there; bold/italic stay, and
// highlight outside the selection is untouched.
{
    const h = await makeHarness();
    const editor = h.instance.data.editor;
    const { from } = rangeOf(editor, "Bold highlighted");
    const { to } = rangeOf(editor, "italic highlighted");
    editor.commands.setTextSelection({ from, to });
    clearHighlight(h.instance, {}, h.context);
    assert.deepEqual(marksAt(editor, "Bold highlighted"), ["bold"]);
    assert.deepEqual(marksAt(editor, "italic highlighted"), ["italic"]);
    assert.deepEqual(marksAt(editor, "untouched"), ["highlight"]);
    assert.doesNotMatch(editor.getHTML(), /<mark[^>]*>Bold/);
    assert.equal(h.reports.length, 0);
    h.instance.data.teardownEditor("test");
}

// Highlight extension off: the action reports instead of throwing.
{
    const h = await makeHarness({ ext_highlight: false });
    clearHighlight(h.instance, {}, h.context);
    assert.equal(h.reports.length, 1);
    assert.match(h.reports[0], /Clear Highlight.*Highlight extension is not enabled/);
    h.instance.data.teardownEditor("test");
}

// Editor not ready: the action reports instead of throwing.
{
    const h = await makeHarness();
    h.instance.data.teardownEditor("test");
    h.instance.data.editor_is_ready = false;
    clearHighlight(h.instance, {}, h.context);
    assert.match(h.reports.at(-1), /Tried to run Clear Highlight before editor was ready/);
}

console.log(JSON.stringify({ clearsHighlightOnly: true, keepsOtherMarks: true, guardsExtension: true, guardsReady: true }));
