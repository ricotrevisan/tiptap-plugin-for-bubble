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

const bundledFindAndReplace = window.tiptap.FindAndReplace;
assert.ok(bundledFindAndReplace, "the shipped bundle must provide Find & Replace");
delete window.tiptap.FindAndReplace; // Simulate a stale CDN bundle to exercise the fallback.

// ── Runtime without the extension: the toggle must not destroy the editor ─────
const missing = await makeHarness({ ext_find_replace: true });
assert.equal(missing.states.get("is_ready"), true, "editor must still become ready when the toggle is on");
assert.ok(missing.instance.data.editor, "the editor must exist");
assert.equal(missing.instance.data.editor.isDestroyed, false, "the editor must not be destroyed");
assert.equal(missing.instance.data.ext.findreplace, false, "the extension must report itself inactive");
assert.equal(missing.states.get("contentText"), "Hello", "content must still load");
assert.ok(
    missing.debuggerMessages.some((message) => message.includes("Find & Replace")),
    "the debugger must explain that Find & Replace is unavailable: " + JSON.stringify(missing.debuggerMessages),
);

// The Find action must report, not throw, when the runtime cannot provide it.
assert.doesNotThrow(() => findAction(missing.instance, missing.properties));
assert.ok(
    missing.debuggerMessages.some((message) => message.includes("Find & Replace")),
    "the Find action must report the missing extension",
);

// ── Runtime that provides the extension: the guard must not disable it ────────
const stub = window.tiptap.Extension.create({ name: "findAndReplace", addStorage: () => ({ results: [] }) });
window.tiptap.FindAndReplace = { configure: () => stub };
try {
    const provided = await makeHarness({ ext_find_replace: true });
    assert.equal(provided.instance.data.ext.findreplace, true, "the toggle must stay active when the runtime provides the extension");
    assert.equal(provided.states.get("is_ready"), true);
    assert.ok(
        provided.instance.data.editor.extensionManager.extensions.some((extension) => extension.name === "findAndReplace"),
        "the extension must be installed in the editor",
    );
    assert.deepEqual(provided.debuggerMessages, [], "no warning is expected when the extension is available");

    // The toggle off must leave the extension out entirely.
    const off = await makeHarness();
    assert.equal(off.instance.data.ext.findreplace, false);
    assert.ok(
        !off.instance.data.editor.extensionManager.extensions.some((extension) => extension.name === "findAndReplace"),
        "the extension must not be installed while the toggle is off",
    );
} finally {
    window.tiptap.FindAndReplace = bundledFindAndReplace;
}

console.log("Find & Replace guard lifecycle passed");
