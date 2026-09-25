import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Window } from "happy-dom";

// WTF-262: text typed at a link's right edge is plain text. Text typed as a
// link (after Set link with nothing selected, or over a selected link) keeps
// the link until the caret moves. Contract: docs/wtf-262/link-boundary-contract.md.

const libRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = resolve(libRoot, "..");
const window = new Window({ url: "https://example.test" });
Object.assign(globalThis, {
    window, document: window.document, Node: window.Node, Element: window.Element, HTMLElement: window.HTMLElement,
    ShadowRoot: window.ShadowRoot, MutationObserver: window.MutationObserver, ClipboardEvent: window.ClipboardEvent,
    DOMParser: window.DOMParser, getComputedStyle: window.getComputedStyle.bind(window),
    requestAnimationFrame: callback => setTimeout(() => callback(Date.now()), 0),
    cancelAnimationFrame: clearTimeout,
});
Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true });
await import(pathToFileURL(resolve(libRoot, "dist.js")));

const source = name => readFileSync(resolve(root, `src/elements/tiptap-AAC/${name}.js`), "utf8");
const initialize = new Function("instance", "context", source("initialize"));
const update = new Function("instance", "properties", "context", source("update"));
const setLink = new Function("instance", "properties", "context", source("actions/set-link-ACN"));
const removeLink = new Function("instance", "properties", "context", source("actions/remove-link-ACR"));
const setContent = new Function("instance", "properties", "context", source("actions/set-content-ACW"));
const metadata = JSON.parse(readFileSync(resolve(root, "src/elements/tiptap-AAC/AAC.json"), "utf8"));
const defaults = Object.fromEntries(Object.values(metadata.fields).map(field => [field.name, field.default_val]));

assert.equal(typeof window.tiptap.Plugin, "function", "the runtime exports Plugin");
assert.equal(typeof window.tiptap.PluginKey, "function", "the runtime exports PluginKey");

const settle = () => window.happyDOM.whenAsyncComplete();
const URL = "https://example.com";

async function makeEditor(overrides = {}) {
    const canvas = document.createElement("div");
    document.body.appendChild(canvas);
    const states = new Map(), messages = [];
    const instance = {
        data: {},
        canvas: { 0: canvas, css() {}, append: node => canvas.appendChild(node), parent: () => ({ length: 0 }), height() {} },
        publishState: (key, value) => states.set(key, value),
        triggerEvent() {}, publishAutobinding() {}, canUploadFile: () => true, uploadFile() {},
    };
    const context = { reportDebugger: message => messages.push(String(message)), reportToDebugger: message => messages.push(String(message)) };
    initialize(instance, context);
    const properties = {
        ...defaults, initialContent: "<p>Read the docs today</p>", content_is_json: false, isEditable: true,
        collab_active: false, ext_history: true, ext_link: true, ...overrides,
        bubble: { auto_binding: () => false, fit_height: () => false, font_size: () => 16,
            font_color: () => "#111111", font_face: () => "Arial:400" },
    };
    update(instance, properties, context);
    await settle();
    assert.equal(states.get("is_ready"), true);
    const h = {
        instance, states, messages,
        get editor() { return instance.data.editor; },
        select(from, to = from) { h.editor.commands.setTextSelection({ from, to }); },
        // Keyboard input: ProseMirror inserts typed text at the selection with
        // the marks it would get from the caret position or stored marks.
        type(text, meta = {}) {
            for (const char of text) {
                const tr = h.editor.state.tr.insertText(char);
                for (const [key, value] of Object.entries(meta)) tr.setMeta(key, value);
                h.editor.view.dispatch(tr);
            }
        },
        setLink: () => setLink(instance, { url: URL }, context),
        removeLink: () => removeLink(instance, {}, context),
        linked() {
            const texts = [];
            h.editor.state.doc.descendants(node => {
                if (node.isText && node.marks.some(mark => mark.type.name === "link")) texts.push(node.text);
            });
            return texts.join("|");
        },
        close() { instance.data.teardownEditor("test complete"); canvas.remove(); },
    };
    return h;
}

for (const autolink of [true, false]) {
    const label = `autolink ${autolink ? "on" : "off"}`;
    const h = await makeEditor({ link_autolink: autolink });
    assert.equal(h.editor.schema.marks.link.spec.inclusive, false, `${label}: links are not inclusive`);

    // 1. Set link keeps the selection; typing at the right edge is plain text.
    h.select(10, 14);
    h.setLink();
    assert.deepEqual([h.editor.state.selection.from, h.editor.state.selection.to], [10, 14], `${label}: selection kept`);
    assert.equal(h.states.get("link"), true);
    h.select(14);
    h.type(" now");
    assert.equal(h.linked(), "docs", `${label}: text typed at the right edge is plain`);

    // 2. A link at the end of a paragraph.
    h.select(h.editor.state.doc.content.size - 1 - "today".length, h.editor.state.doc.content.size - 1);
    h.setLink();
    h.select(h.editor.state.doc.content.size - 1);
    h.type("!");
    assert.equal(h.linked(), "docs|today", `${label}: text typed after a link at the end of a line is plain`);

    // 3. Inside a link typing extends it; at its left edge it does not.
    h.select(13);
    h.type("X");
    h.select(10);
    h.type("Y");
    assert.equal(h.linked(), "docXs|today", `${label}: inside a link extends it, left edge does not`);
    h.close();
}

// 4. Typing that reaches ProseMirror while it still holds the linked selection
//    (click not yet read) inserts next to the link; that text stays plain.
{
    const h = await makeEditor();
    h.select(10, 14);
    h.setLink();
    const { state } = h.editor;
    const tr = state.tr.insertText(" now", 14, 14);
    tr.setSelection(state.selection.constructor.near(tr.doc.resolve(18)));
    h.editor.view.dispatch(tr);
    assert.equal(h.linked(), "docs", "inserting beside a stale linked selection stays plain");
    h.close();
}

// 5. Set link with nothing selected links the text typed next, until the caret moves.
{
    const h = await makeEditor();
    h.select(14);
    h.setLink();
    h.type(" guide");
    assert.equal(h.linked(), " guide", "every typed character joins the new link");
    h.select(21);
    h.select(20);
    h.type(" now");
    assert.equal(h.linked(), " guide", "after the caret moves, typing is plain");
    h.close();
}

// 6. Retyping a whole selected link keeps the link; undo restores the original.
{
    const h = await makeEditor();
    h.select(10, 14);
    h.setLink();
    h.select(10, 14);
    h.type("guide");
    assert.equal(h.linked(), "guide", "retyped text keeps the link");
    h.editor.commands.undo();
    assert.equal(h.linked(), "docs", "undo restores the original link text");
    h.close();
}

// 7. Paste over a selected link, and remote collaboration edits, never relink.
{
    const h = await makeEditor();
    h.select(10, 14);
    h.setLink();
    h.select(10, 14);
    h.type("guide", { uiEvent: "paste" });
    assert.equal(h.linked(), "", "pasted text is not turned into a link");
    h.select(10, 15);
    h.setLink();
    h.select(15);
    h.editor.view.dispatch(h.editor.state.tr.setStoredMarks([h.editor.schema.marks.link.create({ href: URL })]));
    h.type("s", { addToHistory: false });
    h.type("!");
    assert.equal(h.linked(), "guides", "a remote edit does not keep the link going");
    h.close();
}

// 8. Remove link removes it on purpose and keeps the text.
{
    const h = await makeEditor();
    h.select(10, 14);
    h.setLink();
    h.removeLink();
    assert.equal(h.linked(), "");
    assert.equal(h.editor.getHTML(), "<p>Read the docs today</p>");
    assert.equal(h.states.get("link"), false);
    h.close();
}

// 9. HTML and JSON round trips keep links, target and rel unchanged.
{
    const h = await makeEditor({ link_target: "_self", link_rel: "noopener" });
    h.select(10, 14);
    h.setLink();
    const html = h.editor.getHTML(), json = JSON.stringify(h.editor.getJSON());
    assert.equal(html, '<p>Read the <a target="_self" rel="noopener" href="https://example.com">docs</a> today</p>');
    setContent(h.instance, { content: html, is_json: false, parseOptions_preserveWhitespace: "false" }, {});
    assert.equal(h.editor.getHTML(), html, "HTML round trip");
    setContent(h.instance, { content: json, is_json: true, parseOptions_preserveWhitespace: "false" }, {});
    assert.equal(JSON.stringify(h.editor.getJSON()), json, "JSON round trip");
    assert.deepEqual(h.messages, []);
    h.close();
}

console.log("link boundary lifecycle: ok");
