import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Window } from "happy-dom";

// Set content defaults to preserveWhitespace "full", which Tiptap parses as a
// slice. A slice rejects an empty <li> ("Invalid content for node listItem"),
// although a document parse repairs it. The action falls back to a document
// parse instead of failing, and keeps "full" for content it accepts.

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
const setContentAction = new Function("instance", "properties", "context", source("actions/set-content-ACW"));
const metadata = JSON.parse(readFileSync(resolve(elementRoot, "AAC.json"), "utf8"));
const defaults = Object.fromEntries(Object.values(metadata.fields).map(field => [field.name, field.default_val]));

assert.equal(metadata.actions.ACW?.caption, "Set content");

async function makeHarness() {
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
        initialContent: "<p>start</p>",
        content_is_json: false, isEditable: true, collab_active: false,
        bubble: { auto_binding: () => false, fit_height: () => false, font_size: () => 16, font_color: () => "#111111", font_face: () => "Arial:400" },
    }, { get: (target, key) => key in target ? target[key] : undefined });
    instance.data.setupEditor(properties, context);
    await window.happyDOM.whenAsyncComplete();
    return { instance, context, reports };
}

const h = await makeHarness();
const editor = h.instance.data.editor;
// The trailing-node extension appends an empty paragraph after a list.
const html = () => editor.getHTML().replace(/<p><\/p>$/, "");
const run = (content, extra = {}) => {
    h.reports.length = 0;
    setContentAction(h.instance, { content, is_json: false, ...extra }, h.context);
};

// Default ("full"): empty list items, as in question templates, load.
run("<ul><li>Why not?<ul><li></li></ul></li></ul>");
assert.deepEqual(h.reports, []);
assert.equal(html(), "<ul><li><p>Why not?</p><ul><li><p></p></li></ul></li></ul>");

// Content "full" accepts keeps its whitespace.
run("<p>a  b</p>");
assert.deepEqual(h.reports, []);
assert.equal(html(), "<p>a  b</p>");

// true and false already parse as a document.
run("<ul><li></li></ul>", { parseOptions_preserveWhitespace: "false" });
assert.deepEqual(h.reports, []);
assert.equal(html(), "<ul><li><p></p></li></ul>");

// Invalid JSON is still rejected: a document parse would load it unchecked.
run("<p>before json</p>");
run(JSON.stringify({ type: "doc", content: [{ type: "bulletList", content: [{ type: "listItem", content: [] }] }] }), { is_json: true });
assert.equal(h.reports.length, 1);
assert.match(h.reports[0], /There was an error running setContent/);
assert.equal(html(), "<p>before json</p>");
editor.state.doc.check();

// Errors that are not about the parse mode are still reported.
run("{not json", { is_json: true });
assert.equal(h.reports.length, 1);
assert.match(h.reports[0], /There was an error running setContent/);

h.instance.data.teardownEditor("test");
console.log("set-content-action: ok");
