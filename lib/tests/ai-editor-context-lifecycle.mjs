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
const update = new Function(
    "instance",
    "properties",
    "context",
    readFileSync(resolve(root, "src/elements/tiptap-AAC/update.js"), "utf8"),
);

async function makeHarness(aiEnabled, propertyOverrides = {}) {
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
            ext_ai_toolkit: aiEnabled,
            initialContent: "<p>Hello</p>",
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

const enabled = await makeHarness(true);
assert.equal(enabled.states.get("is_ready"), true);
const rawContext = enabled.states.get("ai_editor_context");
const parsedContext = JSON.parse(rawContext);
assert.ok(parsedContext.serializedSchema?.nodes?.paragraph);
assert.ok(Array.isArray(parsedContext.items) && parsedContext.items.length > 0);
assert.deepEqual(enabled.debuggerMessages, []);

// Disabling must clear stale context even when collaboration prerequisites
// cause update.js to return before a replacement editor can be created.
enabled.properties.ext_ai_toolkit = false;
enabled.properties.collab_active = true;
enabled.properties.collab_jwt = "";
update(enabled.instance, enabled.properties, enabled.context);
await window.happyDOM.whenAsyncComplete();
assert.equal(enabled.instance.data.editor_is_ready, false);
assert.equal(enabled.states.get("ai_editor_context"), "");

// Once prerequisites permit setup again, the disabled schema is rebuilt once.
enabled.properties.collab_active = false;
update(enabled.instance, enabled.properties, enabled.context);
await window.happyDOM.whenAsyncComplete();
assert.equal(enabled.instance.data.editor_is_ready, true);
assert.equal(enabled.instance.data._currentAiToolkitEnabled, false);
assert.equal(enabled.states.get("ai_editor_context"), "");

// Schema rebuilds must preserve the current unsaved local document instead of
// resetting it to the original initialContent property.
enabled.instance.data.editor.commands.setContent("<p>Unsaved local edit</p>");
assert.match(enabled.instance.data.editor.getHTML(), /Unsaved local edit/);
enabled.properties.ext_ai_toolkit = true;
update(enabled.instance, enabled.properties, enabled.context);
await window.happyDOM.whenAsyncComplete();
assert.equal(enabled.instance.data.editor_is_ready, true);
assert.equal(enabled.instance.data._currentAiToolkitEnabled, true);
assert.doesNotThrow(() => JSON.parse(enabled.states.get("ai_editor_context")));
assert.match(enabled.instance.data.editor.getHTML(), /Unsaved local edit/);

// A rebuild must not swallow a simultaneous initialContent change: when
// initialContent B and the AI toggle arrive in one update, the preserved
// snapshot wins for this cycle, but B is recorded and applied on the next
// cycle rather than being treated as already handled.
const switcher = await makeHarness(true);
assert.equal(switcher.states.get("is_ready"), true);
switcher.properties.initialContent = "<p>Doc B</p>";
switcher.properties.ext_ai_toolkit = false;
update(switcher.instance, switcher.properties, switcher.context);
await window.happyDOM.whenAsyncComplete();
assert.equal(switcher.instance.data.editor_is_ready, true);
assert.equal(switcher.instance.data.initialContent, "<p>Hello</p>");

// The new initialContent was recorded, so the next ordinary update must apply it.
update(switcher.instance, switcher.properties, switcher.context);
await window.happyDOM.whenAsyncComplete();
assert.equal(switcher.instance.data.initialContent, "<p>Doc B</p>");
assert.match(switcher.instance.data.editor.getHTML(), /Doc B/);
switcher.instance.data.teardownEditor("test");

enabled.instance.data.teardownEditor("test");
assert.equal(enabled.states.get("ai_editor_context"), "");

const disabled = await makeHarness(false);
assert.equal(disabled.states.get("is_ready"), true);
assert.equal(disabled.states.get("ai_editor_context"), "");
disabled.instance.data.teardownEditor("test");

// Context must describe the configured editor, not a generic superset schema.
const withoutHeadings = await makeHarness(true, { ext_heading: false });
const withoutHeadingsContext = JSON.parse(withoutHeadings.states.get("ai_editor_context"));
assert.equal(withoutHeadingsContext.serializedSchema.nodes.heading, undefined);
assert.equal(withoutHeadingsContext.items.some((item) => item.extensionName === "heading"), false);
withoutHeadings.instance.data.teardownEditor("test");

// A toggle is detected against _currentAiToolkitEnabled (captured synchronously at
// construction) gated on isEditorSetup, so even a toggle that arrives while the
// editor is still coming up rebuilds rather than leaving a stale schema/context.
const midCreate = await makeHarness(true);
assert.equal(midCreate.instance.data.isEditorSetup, true);
midCreate.properties.ext_ai_toolkit = false;
update(midCreate.instance, midCreate.properties, midCreate.context);
await window.happyDOM.whenAsyncComplete();
assert.equal(midCreate.instance.data.editor_is_ready, true);
assert.equal(midCreate.instance.data._currentAiToolkitEnabled, false);
assert.equal(midCreate.states.get("ai_editor_context"), "");
midCreate.instance.data.teardownEditor("test");

console.log(
    JSON.stringify({
        contextBytes: rawContext.length,
        schemaNodes: Object.keys(parsedContext.serializedSchema.nodes).length,
        schemaItems: parsedContext.items.length,
        runtimeToggleRebuilt: true,
        runtimeTogglePreservedContent: true,
        configuredExtensionsReflected: true,
        simultaneousInitialContentPreserved: true,
        asyncToggleRebuilt: true,
        teardownCleared: true,
    }),
);
