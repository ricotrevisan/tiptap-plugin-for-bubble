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
assert.equal(metadata.fields.ext_table_of_contents.default_val, false);
assert.equal(metadata.actions.scroll_to_heading.caption, "Scroll to heading");
assert.equal(metadata.states.table_of_contents.value, "text");
assert.equal(metadata.events.table_of_contents_updated.name, "table_of_contents_updated");

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
const scrollToHeading = new Function(
    "instance",
    "properties",
    "context",
    readFileSync(resolve(root, "src/elements/tiptap-AAC/actions/scroll-to-heading-scroll_to_heading.js"), "utf8"),
);

async function makeHarness(propertyOverrides = {}) {
    const rootElement = document.createElement("div");
    document.body.appendChild(rootElement);
    const states = new Map();
    const events = [];
    const debuggerMessages = [];
    const instance = {
        data: {},
        canvas: {
            0: rootElement,
            css() {},
            append(element) { rootElement.appendChild(element); },
            parent() { return { length: 0 }; },
            height() {},
        },
        publishState(name, value) { states.set(name, value); },
        triggerEvent(name) { events.push(name); },
        publishAutobinding() {},
        canUploadFile() { return true; },
        uploadFile() {},
    };
    const context = { reportDebugger(message) { debuggerMessages.push(String(message)); } };
    initialize(instance, context);

    const properties = new Proxy(
        {
            ...defaults,
            initialContent: "<h1>Introduction</h1><p>Opening</p><h2>Details</h2>",
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
    return { instance, states, events, properties, context, debuggerMessages };
}

function tableOfContents(harness) {
    return JSON.parse(harness.states.get("table_of_contents"));
}

// The Bubble toggle is off by default and does not add heading IDs or storage.
const off = await makeHarness({ ext_table_of_contents: false });
assert.deepEqual(tableOfContents(off), []);
assert.equal(off.instance.data.editor.storage.tableOfContents, undefined);
assert.equal(off.instance.data.editor.getJSON().content[0].attrs?.["data-toc-id"], undefined);
off.instance.data.teardownEditor("test");

// Enabled editors publish a serializable outline and an initial update event.
const enabled = await makeHarness({ ext_table_of_contents: true, ext_ai_toolkit: true });
let outline = tableOfContents(enabled);
assert.deepEqual(outline.map(({ textContent, originalLevel, level, itemIndex }) => ({
    textContent,
    originalLevel,
    level,
    itemIndex,
})), [
    { textContent: "Introduction", originalLevel: 1, level: 1, itemIndex: 1 },
    { textContent: "Details", originalLevel: 2, level: 2, itemIndex: 2 },
]);
assert.ok(outline.every((item) => typeof item.id === "string" && item.id.length > 0));
assert.ok(outline.every((item) => !Object.hasOwn(item, "dom") && !Object.hasOwn(item, "editor") && !Object.hasOwn(item, "node")));
assert.ok(enabled.events.includes("table_of_contents_updated"));

// IDs remain in HTML/JSON while AI Toolkit is enabled, and survive a JSON round trip.
const originalIds = outline.map((item) => item.id);
const editorJSON = enabled.instance.data.editor.getJSON();
assert.deepEqual(editorJSON.content.filter((node) => node.type === "heading").map((node) => node.attrs["data-toc-id"]), originalIds);
assert.match(enabled.instance.data.editor.getHTML(), /data-toc-id=/);
assert.doesNotThrow(() => JSON.parse(enabled.states.get("ai_editor_context")));
enabled.instance.data.editor.commands.setContent(editorJSON);
await window.happyDOM.whenAsyncComplete();
outline = tableOfContents(enabled);
assert.deepEqual(outline.map((item) => item.id), originalIds);

// Editing headings republishes the state and keeps it in sync.
const updatesBeforeEdit = enabled.events.filter((event) => event === "table_of_contents_updated").length;
enabled.instance.data.editor.commands.setContent("<h1>Revised</h1><h3>New section</h3><p>Body</p>");
await window.happyDOM.whenAsyncComplete();
outline = tableOfContents(enabled);
assert.deepEqual(outline.map((item) => item.textContent), ["Revised", "New section"]);
assert.ok(enabled.events.filter((event) => event === "table_of_contents_updated").length > updatesBeforeEdit);

// The workflow action scrolls the matching heading without changing the public ID contract.
let scrollOptions;
const target = enabled.instance.data.editor.storage.tableOfContents.content[1].dom;
target.scrollIntoView = (options) => { scrollOptions = options; };
scrollToHeading(enabled.instance, { heading_id: outline[1].id, behavior: "smooth", block: "center" }, enabled.context);
assert.deepEqual(scrollOptions, { behavior: "smooth", block: "center" });
scrollToHeading(enabled.instance, { heading_id: "missing" }, enabled.context);
assert.match(enabled.debuggerMessages.at(-1), /No table of contents heading found/);
enabled.instance.data.teardownEditor("test");

// A runtime toggle rebuilds the construction-time extension without losing local edits.
const runtime = await makeHarness({ ext_table_of_contents: false });
runtime.instance.data.editor.commands.setContent("<h2>Unsaved heading</h2><p>Unsaved body</p>");
runtime.properties.ext_table_of_contents = true;
update(runtime.instance, runtime.properties, runtime.context);
await window.happyDOM.whenAsyncComplete();
assert.deepEqual(tableOfContents(runtime).map((item) => item.textContent), ["Unsaved heading"]);
assert.match(runtime.instance.data.editor.getText(), /Unsaved body/);
runtime.instance.data.teardownEditor("test");

// Disabled actions fail safely through Bubble's debugger.
const disabled = await makeHarness({ ext_table_of_contents: false });
scrollToHeading(disabled.instance, { heading_id: "anything" }, disabled.context);
assert.match(disabled.debuggerMessages.at(-1), /Table of Contents extension is not enabled/);
disabled.instance.data.teardownEditor("test");

console.log(JSON.stringify({
    toggledOffByDefault: true,
    outlineStaysInSync: true,
    idsSurviveAiToolkitRoundTrip: true,
    scrollActionWorks: true,
    runtimeTogglePreservesContent: true,
    disabledActionFailsSafely: true,
}));
