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
assert.equal(metadata.fields.ext_find_replace.default_val, false);
assert.equal(metadata.actions.find.caption, "Find");
assert.equal(metadata.actions.replace.caption, "Replace");
assert.equal(metadata.actions.replace_all.caption, "Replace all");
assert.equal(metadata.states.find_replace_state.value, "text");

const initialize = new Function(
    "instance",
    "context",
    readFileSync(resolve(root, "src/elements/tiptap-AAC/initialize.js"), "utf8"),
);
const update = new Function(
    "instance",
    "properties",
    "context",
    readFileSync(resolve(root, "src/elements/tiptap-AAC/update.js"), "utf8"),
);
const actions = {
    find: new Function(
        "instance",
        "properties",
        "context",
        readFileSync(resolve(root, "src/elements/tiptap-AAC/actions/find-find.js"), "utf8"),
    ),
    replace: new Function(
        "instance",
        "properties",
        "context",
        readFileSync(resolve(root, "src/elements/tiptap-AAC/actions/replace-replace.js"), "utf8"),
    ),
    replaceAll: new Function(
        "instance",
        "properties",
        "context",
        readFileSync(resolve(root, "src/elements/tiptap-AAC/actions/replace-all-replace_all.js"), "utf8"),
    ),
};

async function makeHarness(propertyOverrides = {}) {
    const rootElement = document.createElement("div");
    document.body.appendChild(rootElement);
    const states = new Map();
    const debuggerMessages = [];
    const instance = {
        data: {},
        canvas: {
            css() {},
            append(element) { rootElement.appendChild(element); },
            parent() { return { length: 0 }; },
            height() {},
        },
        publishState(name, value) { states.set(name, value); },
        triggerEvent() {},
        publishAutobinding() {},
        canUploadFile() { return true; },
        uploadFile() {},
    };
    const context = { reportDebugger(message) { debuggerMessages.push(message); } };
    initialize(instance, context);

    const properties = new Proxy(
        {
            ...defaults,
            initialContent: "<p>Alpha beta alpha.</p>",
            content_is_json: false,
            isEditable: true,
            collab_active: false,
            ...propertyOverrides,
            bubble: {
                auto_binding: () => false,
                fit_height: () => false,
                font_size: () => 16,
                font_color: () => "#111111",
                font_face: () => "Arial:400",
            },
        },
        { get(target, key) { return key in target ? target[key] : undefined; } },
    );

    instance.data.setupEditor(properties, context);
    await window.happyDOM.whenAsyncComplete();
    return { instance, states, properties, context, debuggerMessages };
}

function findReplaceState(harness) {
    return JSON.parse(harness.states.get("find_replace_state"));
}

// The Bubble element toggle controls whether the extension and commands exist.
const off = await makeHarness({ ext_find_replace: false });
assert.equal(typeof off.instance.data.editor.commands.setSearchTerm, "undefined");
assert.deepEqual(findReplaceState(off), {
    searchTerm: "",
    replaceTerm: "",
    currentMatch: 0,
    matchCount: 0,
    caseSensitive: false,
    useRegex: false,
    wholeWord: false,
});
off.instance.data.teardownEditor("test");

const h = await makeHarness({ ext_find_replace: true });
assert.equal(typeof h.instance.data.editor.commands.setSearchTerm, "function");

// Find highlights every case-insensitive match and selects the first match.
actions.find(h.instance, {
    search_term: "alpha",
    direction: "next",
    case_sensitive: false,
    use_regex: false,
    whole_word: false,
}, h.context);
let state = findReplaceState(h);
assert.equal(state.matchCount, 2);
assert.equal(state.currentMatch, 1);
assert.equal(h.instance.data.editor.state.doc.textBetween(
    h.instance.data.editor.state.selection.from,
    h.instance.data.editor.state.selection.to,
), "Alpha");
assert.equal(document.querySelectorAll(".find-and-replace-result").length, 2);

// Running Find again navigates forward and wraps; previous navigates backward.
actions.find(h.instance, {
    search_term: "alpha",
    direction: "next",
    case_sensitive: false,
    use_regex: false,
    whole_word: false,
}, h.context);
assert.equal(findReplaceState(h).currentMatch, 2);
actions.find(h.instance, {
    search_term: "alpha",
    direction: "next",
    case_sensitive: false,
    use_regex: false,
    whole_word: false,
}, h.context);
assert.equal(findReplaceState(h).currentMatch, 1);
actions.find(h.instance, {
    search_term: "alpha",
    direction: "previous",
    case_sensitive: false,
    use_regex: false,
    whole_word: false,
}, h.context);
assert.equal(findReplaceState(h).currentMatch, 2);

// Replace changes the current match and republishes both editor and find state.
actions.replace(h.instance, { replacement: "omega" }, h.context);
state = findReplaceState(h);
assert.equal(state.matchCount, 1);
assert.equal(state.currentMatch, 1);
assert.equal(h.states.get("contentText"), "Alpha beta omega.");

// Replace all changes every remaining match and clears the match state.
actions.replaceAll(h.instance, { replacement: "done" }, h.context);
state = findReplaceState(h);
assert.equal(state.matchCount, 0);
assert.equal(state.currentMatch, 0);
assert.equal(h.states.get("contentText"), "done beta omega.");
assert.match(h.states.get("contentHTML"), /done beta omega/);
h.instance.data.teardownEditor("test");

// The dynamic extension toggle rebuilds the editor without discarding unsaved local content.
const runtime = await makeHarness({ ext_find_replace: false });
runtime.instance.data.editor.commands.setContent("<p>Unsaved local edit</p>");
runtime.properties.ext_find_replace = true;
update(runtime.instance, runtime.properties, runtime.context);
await window.happyDOM.whenAsyncComplete();
assert.equal(typeof runtime.instance.data.editor.commands.setSearchTerm, "function");
assert.equal(runtime.instance.data.editor.getText(), "Unsaved local edit");
runtime.instance.data.teardownEditor("test");

// Disabled actions fail safely through Bubble's debugger rather than throwing.
const disabled = await makeHarness({ ext_find_replace: false });
actions.find(disabled.instance, { search_term: "alpha", direction: "next" }, disabled.context);
assert.match(disabled.debuggerMessages.at(-1), /Find & Replace extension is not enabled/);
disabled.instance.data.teardownEditor("test");

console.log(JSON.stringify({
    toggledOffByDefault: true,
    highlightsAllMatches: true,
    navigationWraps: true,
    replaceUpdatesStates: true,
    replaceAllUpdatesStates: true,
    runtimeTogglePreservesContent: true,
    disabledActionsFailSafely: true,
}));
