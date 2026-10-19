import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Window } from "happy-dom";

// Submit on Enter (chat composers): with the property on, a plain Enter fires
// Enter pressed and adds no new line. Enter keeps its usual meaning with
// Shift/Ctrl/Alt/Cmd, during IME composition, while a mention list is open,
// in code blocks and list items, and in a read-only editor. Off by default.

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
const metadata = JSON.parse(readFileSync(resolve(root, "src/elements/tiptap-AAC/AAC.json"), "utf8"));
const defaults = Object.fromEntries(Object.values(metadata.fields).map(field => [field.name, field.default_val]));

const field = metadata.fields.submit_on_enter;
assert.equal(field?.caption, "Submit on Enter");
assert.equal(field.default_val, false, "off by default");
assert.equal(metadata.events.enter_pressed?.caption, "Enter pressed");
assert.equal(metadata.events.enter_pressed.name, "enter_pressed");

const settle = () => window.happyDOM.whenAsyncComplete();
const thing = values => ({ get: key => values[key] });
const list = items => ({ length: () => items.length, get: (start, count) => items.slice(start, start + count) });

async function makeEditor(overrides = {}) {
    const canvas = document.createElement("div");
    document.body.appendChild(canvas);
    const states = new Map(), events = [];
    const instance = {
        data: {},
        canvas: { 0: canvas, css() {}, append: node => canvas.appendChild(node), parent: () => ({ length: 0 }), height() {} },
        publishState: (key, value) => states.set(key, value),
        // Snapshot the text when each event fires: workflows read it then.
        triggerEvent: name => events.push({ name, text: states.get("contentText") }),
        publishAutobinding() {}, canUploadFile: () => true, uploadFile() {},
    };
    const context = { reportDebugger() {} };
    initialize(instance, context);
    const properties = {
        ...defaults, initialContent: "<p>Hello</p>", content_is_json: false, isEditable: true, collab_active: false,
        ext_codeblock: true, ext_bulletlist: true, ext_orderedlist: true, ext_tasklist: true,
        ext_mention: true, mention_list: list([thing({ name: "Ada Lovelace", uid: "ada" })]),
        mention_field_label: "name", mention_field_id: "uid", mention_triggerChar: "@",
        // Exact HTML below: no trailing paragraph after lists and code.
        ext_trailingnode: false, submit_on_enter: true,
        ...overrides,
        bubble: { auto_binding: () => false, fit_height: () => false, font_size: () => 16,
            font_color: () => "#111111", font_face: () => "Arial:400" },
    };
    const h = {
        instance, properties, states, events,
        get editor() { return instance.data.editor; },
        pressed: () => events.filter(event => event.name === "enter_pressed"),
        async change(values = {}) {
            Object.assign(properties, values);
            update(instance, properties, context);
            await settle();
        },
        // Loads content with the cursor at the end of the first textblock.
        async load(html) {
            h.editor.commands.setContent(html);
            let end = null;
            h.editor.state.doc.descendants((node, pos) => {
                if (end === null && node.isTextblock) end = pos + 1 + node.content.size;
            });
            h.editor.commands.focus(end);
            await settle();
        },
        async type(text) {
            h.editor.commands.focus("end");
            h.editor.commands.insertContent(text);
            await settle();
        },
        // Returns whether a handler took the key (the browser default is then prevented).
        async press(key, init = {}) {
            const event = new window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init });
            const handled = h.editor.view.someProp("handleKeyDown", handler => handler(h.editor.view, event));
            await settle();
            return !!handled;
        },
        close() { instance.data.teardownEditor("test complete"); canvas.remove(); },
    };
    await h.change();
    assert.equal(states.get("is_ready"), true);
    return h;
}

// 1. Off (the default): Enter starts a new paragraph and fires nothing.
{
    const h = await makeEditor({ submit_on_enter: defaults.submit_on_enter });
    await h.load("<p>Hello</p>");
    assert.equal(await h.press("Enter"), true);
    assert.equal(h.editor.getHTML(), "<p>Hello</p><p></p>");
    assert.equal(h.pressed().length, 0, "off: no event");
    h.close();
}

// 2. On: Enter fires once, adds no line, and the typed text is already published.
{
    const h = await makeEditor();
    await h.load("<p></p>");
    await h.type("Hi there");
    h.events.length = 0;
    assert.equal(await h.press("Enter"), true, "Enter is consumed");
    assert.equal(h.editor.getHTML(), "<p>Hi there</p>", "no new line");
    assert.deepEqual(h.pressed().map(event => event.text), ["Hi there"]);
    // Pending edits are submitted before the workflow runs, as on blur.
    const names = h.events.map(event => event.name);
    assert.ok(names.indexOf("contentUpdated") >= 0 && names.indexOf("contentUpdated") < names.indexOf("enter_pressed"),
        `Content updated fires before Enter pressed (${names.join(", ")})`);
    // Mid-paragraph too: the paragraph is not split.
    h.editor.commands.setTextSelection(3);
    assert.equal(await h.press("Enter"), true);
    assert.equal(h.editor.getHTML(), "<p>Hi there</p>");
    assert.equal(h.pressed().length, 2);
    // An empty editor still fires; builders add an Is empty? condition.
    await h.load("<p></p>");
    await h.press("Enter");
    assert.equal(h.pressed().length, 3);
    assert.equal(h.editor.getHTML(), "<p></p>");
    h.close();
}

// 3. Shift+Enter: a line break with Hard Break on, a new paragraph without it.
{
    const withBreak = await makeEditor({ ext_hardbreak: true });
    await withBreak.load("<p>Hello</p>");
    assert.equal(await withBreak.press("Enter", { shiftKey: true }), true);
    assert.equal(withBreak.editor.getHTML(), "<p>Hello<br></p>");
    assert.equal(withBreak.pressed().length, 0);
    withBreak.close();

    const withoutBreak = await makeEditor({ ext_hardbreak: false });
    await withoutBreak.load("<p>Hello</p>");
    assert.equal(await withoutBreak.press("Enter", { shiftKey: true }), true);
    assert.equal(withoutBreak.editor.getHTML(), "<p>Hello</p><p></p>");
    assert.equal(withoutBreak.pressed().length, 0);
    withoutBreak.close();
}

// 4. Ctrl, Alt or Cmd held, and IME composition: Enter keeps its usual meaning.
{
    const h = await makeEditor();
    for (const init of [{ ctrlKey: true }, { altKey: true }, { metaKey: true }, { isComposing: true }, { keyCode: 229 }]) {
        await h.load("<p>Hello</p>");
        await h.press("Enter", init);
        assert.equal(h.pressed().length, 0, `no event with ${JSON.stringify(init)}`);
    }
    h.close();
}

// 5. Code blocks and list items keep Enter.
{
    const h = await makeEditor();
    await h.load("<pre><code>const a = 1;</code></pre>");
    assert.equal(await h.press("Enter"), true);
    assert.match(h.editor.getHTML(), /^<pre><code>const a = 1;\n<\/code><\/pre>/, "newline in code");

    await h.load("<ul><li><p>one</p></li></ul>");
    await h.press("Enter");
    assert.equal(h.editor.getHTML(), "<ul><li><p>one</p></li><li><p></p></li></ul>", "new bullet");
    // Enter on the empty item leaves the list; the next Enter submits.
    await h.press("Enter");
    assert.equal(h.editor.getHTML(), "<ul><li><p>one</p></li></ul><p></p>", "empty item lifts out of the list");
    assert.equal(h.pressed().length, 0);
    await h.press("Enter");
    assert.equal(h.pressed().length, 1, "Enter below the list submits");

    await h.load("<ol><li><p>one</p></li></ol>");
    await h.press("Enter");
    assert.equal(h.editor.getHTML(), "<ol><li><p>one</p></li><li><p></p></li></ol>", "new numbered item");

    await h.load('<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>todo</p></li></ul>');
    await h.press("Enter");
    assert.equal(h.editor.state.doc.firstChild.childCount, 2, "new task item");
    assert.equal(h.pressed().length, 1, "lists and code never fire");
    h.close();
}

// 6. An open mention list takes Enter; once it closes, Enter submits.
{
    const h = await makeEditor();
    await h.load("<p>Hi</p>");
    await h.type(" @");
    await h.type("Ad");
    assert.equal(h.instance.data.suggestionOpen, true, "mention list is open");
    await h.press("Enter");
    let mentions = 0;
    h.editor.state.doc.descendants(node => { if (node.type.name === "mention") mentions++; });
    assert.equal(mentions, 1, "Enter picked the mention");
    assert.equal(h.instance.data.suggestionOpen, false);
    assert.equal(h.pressed().length, 0);
    await h.press("Enter");
    assert.equal(h.pressed().length, 1);
    h.close();
}

// 7. A dynamic value applies without rebuilding; a read-only editor never fires.
{
    const h = await makeEditor({ submit_on_enter: false });
    const editor = h.editor;
    await h.load("<p>Hello</p>");
    await h.press("Enter");
    assert.equal(h.pressed().length, 0);
    await h.change({ submit_on_enter: true });
    assert.equal(h.editor, editor, "no rebuild");
    await h.load("<p>Hello</p>");
    await h.press("Enter");
    assert.equal(h.pressed().length, 1);
    assert.equal(h.editor.getHTML(), "<p>Hello</p>");

    await h.change({ isEditable: false });
    assert.equal(h.editor.isEditable, false);
    await h.press("Enter");
    assert.equal(h.pressed().length, 1, "read-only: no event");
    h.close();
}

console.log("submit-on-enter-lifecycle: ok");
