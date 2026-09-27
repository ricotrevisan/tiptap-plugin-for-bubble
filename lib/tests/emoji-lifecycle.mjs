import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Window } from "happy-dom";

// WTF-236, Emoji slice: inline node, Bubble workflow insertion, toggle,
// read-only rendering, and HTML/JSON content round trips.
const libRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const elementRoot = resolve(libRoot, "../src/elements/tiptap-AAC");
const window = new Window({ url: "https://example.test", settings: { disableCSSFileLoading: true, disableJavaScriptFileLoading: true } });
Object.assign(globalThis, {
    window, document: window.document, Node: window.Node, Element: window.Element, HTMLElement: window.HTMLElement,
    ShadowRoot: window.ShadowRoot, MutationObserver: window.MutationObserver, DOMParser: window.DOMParser,
    getComputedStyle: window.getComputedStyle.bind(window),
    requestAnimationFrame: callback => setTimeout(() => callback(Date.now()), 0), cancelAnimationFrame: clearTimeout,
});
Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true });
await import(pathToFileURL(resolve(libRoot, "dist.js")));
const source = path => readFileSync(resolve(elementRoot, path), "utf8");
const initialize = new Function("instance", "context", source("initialize.js"));
const update = new Function("instance", "properties", "context", source("update.js"));
const insertEmoji = new Function("instance", "properties", "context", source("actions/insert-emoji-insert_emoji.js"));
const setContent = new Function("instance", "properties", "context", source("actions/set-content-ACW.js"));
const metadata = JSON.parse(source("AAC.json"));
const defaults = Object.fromEntries(Object.values(metadata.fields).map(field => [field.name, field.default_val]));
assert.equal(defaults.ext_emoji, false, "Emoji is off by default");
assert.equal(metadata.actions.insert_emoji.caption, "Insert emoji");
assert.equal(Object.values(metadata.actions.insert_emoji.fields)[0].name, "emoji_name");

async function makeEditor(overrides = {}) {
    const canvas = document.createElement("div");
    document.body.appendChild(canvas);
    const states = new Map(), messages = [];
    const instance = {
        data: {}, canvas: { 0: canvas, css() {}, append: node => canvas.appendChild(node), parent: () => ({ length: 0 }), height() {} },
        publishState: (key, value) => states.set(key, value), triggerEvent() {}, publishAutobinding() {}, canUploadFile: () => true, uploadFile() {},
    };
    const context = { reportDebugger: message => messages.push(String(message)) };
    initialize(instance, context);
    const properties = {
        ...defaults, initialContent: "<p>Hello</p>", content_is_json: false, isEditable: true,
        collab_active: false, ext_history: true, update_delay: 0, ...overrides,
        bubble: { auto_binding: () => false, fit_height: () => false, font_size: () => 16,
            font_color: () => "#111111", font_face: () => "Arial:400" },
    };
    const h = {
        instance, properties, states, messages,
        get editor() { return instance.data.editor; },
        insert: emoji_name => insertEmoji(instance, { emoji_name }, context),
        type(text) {
            for (const char of text) {
                const { view } = h.editor;
                const { from, to } = view.state.selection;
                const deflt = () => view.state.tr.insertText(char, from, to);
                if (!view.someProp("handleTextInput", handler => handler(view, from, to, char, deflt))) view.dispatch(deflt());
            }
        },
        setContent: (content, is_json = false) => setContent(instance, { content, is_json }, context),
        async change(values) { Object.assign(properties, values); update(instance, properties, context); await window.happyDOM.whenAsyncComplete(); },
        close() { instance.data.teardownEditor("test complete"); canvas.remove(); },
    };
    await h.change({});
    assert.equal(states.get("is_ready"), true);
    return h;
}

const off = await makeEditor({ ext_emoji: false });
assert.equal(off.editor.schema.nodes.emoji, undefined, "the disabled extension is absent from the schema");
const before = off.editor.getJSON();
off.insert("smile");
assert.deepEqual(off.editor.getJSON(), before, "disabled workflow action does not mutate content");
assert.ok(off.messages.some(message => /Emoji/.test(message)), "disabled action reports the missing extension");
off.editor.commands.insertContentAt(1, "Draft ");
await off.change({ ext_emoji: true });
assert.ok(off.editor.schema.nodes.emoji, "turning Emoji on rebuilds the editor");
assert.equal(off.editor.getText(), "Draft Hello", "an unsaved change survives rebuild");
off.editor.commands.setTextSelection(7);
off.insert("smile");
assert.equal(off.editor.getJSON().content[0].content[1].type, "emoji");
assert.equal(off.editor.getJSON().content[0].content[1].attrs.name, "smile");
const html = off.editor.getHTML();
assert.match(html, /data-type="emoji"/);
assert.match(html, /data-name="smile"/);
assert.match(html, /<img[^>]+alt="smile emoji"/, "unsupported emoji uses the catalog image fallback");
const json = off.editor.getJSON();
off.setContent(html);
assert.deepEqual(off.editor.getJSON(), json, "HTML round trip preserves emoji node identity");
off.setContent(JSON.stringify(json), true);
assert.deepEqual(off.editor.getJSON(), json, "JSON round trip preserves emoji node identity");
off.insert(":smile:");
assert.equal(off.editor.getJSON().content[0].content.filter(node => node.type === "emoji").length, 2,
    "Bubble action accepts a wrapped shortcode as well as a name");
off.setContent(JSON.stringify(json), true);
off.editor.commands.setTextSelection(off.editor.state.doc.content.size - 1);
off.type(" :smile:");
assert.equal(off.editor.getJSON().content[0].content.filter(node => node.type === "emoji").length, 2,
    "typing a known shortcode creates a node");
const beforeInvalid = off.editor.getJSON();
off.insert("not_an_emoji");
off.insert("");
assert.deepEqual(off.editor.getJSON(), beforeInvalid, "unknown or empty shortcode changes nothing");
assert.equal(off.messages.filter(message => /known emoji name or shortcode/.test(message)).length, 2,
    "both invalid inputs report what the action needs");
await off.change({ ext_emoji: false });
assert.equal(off.editor.schema.nodes.emoji, undefined);
assert.equal(off.editor.getText(), "Draft 😄Hello 😄", "turning Emoji off retains readable Unicode text");
off.close();

const alias = await makeEditor({ ext_emoji: true, initialContent: "<p></p>" });
alias.editor.commands.focus("end");
alias.type(":grinning_face_with_closed_eyes:");
assert.equal(alias.editor.getJSON().content[0].content[0].attrs.name, "grinning_face_with_closed_eyes",
    "the input rule stores the alias rather than its canonical name");
await alias.change({ ext_emoji: false });
assert.equal(alias.editor.getText(), "😄", "turning off converts a shortcode alias to its Unicode emoji");
alias.close();

const unicode = await makeEditor({ ext_emoji: true, initialContent: "<p></p>" });
unicode.editor.commands.insertContent("😄");
assert.equal(unicode.editor.getJSON().content[0].content[0].type, "emoji",
    "the upstream extension also turns known Unicode into nodes when editing");
unicode.close();

const readOnly = await makeEditor({ ext_emoji: true, isEditable: false,
    initialContent: '<p>Hi <span data-type="emoji" data-name="smile">😄</span></p>' });
assert.equal(readOnly.editor.getJSON().content[0].content[1].type, "emoji", "read-only editor parses emoji nodes");
assert.ok(readOnly.editor.view.dom.querySelector('span[data-type="emoji"]'), "read-only editor displays emoji");
readOnly.close();
console.log("emoji-lifecycle: all checks passed");
