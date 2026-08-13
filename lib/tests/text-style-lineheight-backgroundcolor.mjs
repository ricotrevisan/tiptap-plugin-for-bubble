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

async function makeHarness(propertyOverrides = {}) {
    const rootElement = document.createElement("div");
    document.body.appendChild(rootElement);
    const states = new Map();
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
    const context = { reportDebugger() {} };
    initialize(instance, context);

    const properties = new Proxy(
        {
            ...defaults,
            initialContent: "<p>Hello world</p>",
            content_is_json: false,
            isEditable: true,
            collab_active: false,
            ext_lineheight: true,
            ext_backgroundcolor: true,
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
    return { instance, states, properties, context };
}

// Line height and background color extensions are exposed in the editor when toggled on.
const h = await makeHarness();
assert.equal(h.states.get("is_ready"), true);
assert.equal(typeof h.instance.data.editor.chain().setLineHeight, "function");
assert.equal(typeof h.instance.data.editor.chain().setBackgroundColor, "function");

// Select all, set line height and background color, verify they land as inline
// styles on the text-style mark and round-trip through getJSON/setContent.
h.instance.data.editor.commands.selectAll();
h.instance.data.editor.chain().focus().setLineHeight("1.8").run();
h.instance.data.editor.chain().focus().setBackgroundColor("rgb(255, 230, 150)").run();
await window.happyDOM.whenAsyncComplete();

const attrs = h.instance.data.editor.getAttributes("textStyle");
assert.equal(attrs.lineHeight, "1.8");
assert.match(attrs.backgroundColor, /255/);

// HTML carries the inline styles.
const html = h.instance.data.editor.getHTML();
assert.match(html, /line-height: 1\.8/);
assert.match(html, /background-color: rgb\(255, 230, 150\)/);

// States publish the current values.
assert.equal(h.states.get("line_height"), "1.8");
assert.match(h.states.get("background_color"), /255/);

// Round-trip: serialize to JSON, rebuild, restore.
const json = h.instance.data.editor.getJSON();
h.instance.data.editor.commands.setContent(json);
assert.equal(h.instance.data.editor.getAttributes("textStyle").lineHeight, "1.8");

// Unset commands remove the inline styles.
h.instance.data.editor.chain().focus().unsetLineHeight().run();
h.instance.data.editor.chain().focus().unsetBackgroundColor().run();
assert.equal(h.instance.data.editor.getAttributes("textStyle").lineHeight, undefined);
assert.equal(h.instance.data.editor.getAttributes("textStyle").backgroundColor, undefined);
assert.equal(h.states.get("line_height"), "");
assert.equal(h.states.get("background_color"), "");
h.instance.data.teardownEditor("test");

// When toggled off, the extensions are not registered.
const off = await makeHarness({ ext_lineheight: false, ext_backgroundcolor: false });
assert.equal(typeof off.instance.data.editor.chain().setLineHeight, "undefined");
off.instance.data.teardownEditor("test");

console.log(
    JSON.stringify({
        lineHeightApplies: true,
        backgroundColorApplies: true,
        inlineStylesInHTML: true,
        statesPublish: true,
        roundTrips: true,
        unsetClears: true,
        toggledOffNotRegistered: true,
    }),
);
