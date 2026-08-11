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

async function makeHarness(aiEnabled) {
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

enabled.properties.ext_ai_toolkit = false;
update(enabled.instance, enabled.properties, enabled.context);
await window.happyDOM.whenAsyncComplete();
assert.equal(enabled.instance.data.editor_is_ready, true);
assert.equal(enabled.instance.data._currentAiToolkitEnabled, false);
assert.equal(enabled.states.get("ai_editor_context"), "");

enabled.properties.ext_ai_toolkit = true;
update(enabled.instance, enabled.properties, enabled.context);
await window.happyDOM.whenAsyncComplete();
assert.equal(enabled.instance.data.editor_is_ready, true);
assert.equal(enabled.instance.data._currentAiToolkitEnabled, true);
assert.doesNotThrow(() => JSON.parse(enabled.states.get("ai_editor_context")));

enabled.instance.data.teardownEditor("test");
assert.equal(enabled.states.get("ai_editor_context"), "");

const disabled = await makeHarness(false);
assert.equal(disabled.states.get("is_ready"), true);
assert.equal(disabled.states.get("ai_editor_context"), "");
disabled.instance.data.teardownEditor("test");

console.log(
    JSON.stringify({
        contextBytes: rawContext.length,
        schemaNodes: Object.keys(parsedContext.serializedSchema.nodes).length,
        schemaItems: parsedContext.items.length,
        runtimeToggleRebuilt: true,
        teardownCleared: true,
    }),
);
