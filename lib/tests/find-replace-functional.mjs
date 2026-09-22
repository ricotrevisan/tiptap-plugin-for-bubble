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
const findAction = new Function(
    "instance",
    "properties",
    readFileSync(resolve(root, "src/elements/tiptap-AAC/actions/find-find.js"), "utf8"),
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
            ext_history: true,
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
    await window.happyDOM.whenAsyncComplete();
    return { instance, states, debuggerMessages, properties, context };
}


const action = name => new Function('instance', 'properties', readFileSync(resolve(root, 'src/elements/tiptap-AAC/actions', name), 'utf8'));
const replaceAction = action('replace-replace.js');
const replaceAllAction = action('replace-all-replace_all.js');
const h = await makeHarness({ ext_find_replace: true, initialContent: '<p>Cat cat scatter cat</p>' });
const editor = h.instance.data.editor;
assert.ok(window.tiptap.FindAndReplace, 'bundle exports the real extension');
assert.equal(h.states.get('is_ready'), true);
assert.equal(h.instance.data.ext.findreplace, true);
assert.deepEqual(h.debuggerMessages, []);
const state = () => JSON.parse(h.states.get('find_replace_state'));
const find = (term, opts = {}) => findAction(h.instance, { search_term: term, ...opts });
find('cat');
assert.equal(state().matchCount, 4);
assert.equal(state().currentMatch, 1);
find('cat');
assert.equal(state().currentMatch, 2);
find('cat', { direction: 'previous' });
assert.equal(state().currentMatch, 1);
find('cat', { case_sensitive: true, whole_word: true });
assert.equal(state().matchCount, 2);
replaceAction(h.instance, { replacement: 'dog' });
assert.equal(editor.getText(), 'Cat dog scatter cat');
assert.equal(state().matchCount, 1);
replaceAllAction(h.instance, { replacement: 'fox' });
assert.equal(editor.getText(), 'Cat dog scatter fox');
assert.equal(state().matchCount, 0);
find('Cat');
replaceAction(h.instance, { replacement: '' });
assert.equal(editor.getText(), ' dog scatter fox');
find('d.g|f.x', { use_regex: true });
assert.equal(state().matchCount, 2);
replaceAllAction(h.instance, { replacement: 'animal' });
assert.equal(editor.getText(), ' animal scatter animal');
assert.doesNotThrow(() => find('[', { use_regex: true }));
assert.equal(state().matchCount, 0);
find('');
assert.equal(state().searchTerm, '');
assert.equal(state().matchCount, 0);
assert.deepEqual(h.debuggerMessages, []);
h.instance.data.teardownEditor('test done');
await window.happyDOM.abort();
console.log('Real bundle Find, navigation, case/word/regex search, Replace and Replace all passed');
