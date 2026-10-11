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
assert.equal(typeof window.tiptap.TableOfContents?.configure, "function");

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
const setContentAction = new Function(
    "instance",
    "properties",
    "context",
    readFileSync(resolve(root, "src/elements/tiptap-AAC/actions/set-content-ACW.js"), "utf8"),
);

const DOC_A = "<h1>Alpha</h1><h2>Details</h2><p>One</p>";
const DOC_B = "<h1>Beta</h1><h2>Other</h2><p>Two</p>";

function headingTexts(states) {
    const raw = states.get("table_of_contents") || "[]";
    return JSON.parse(raw).map((item) => item.textContent);
}

async function makeHarness({ content = DOC_A, autoBinding = false } = {}) {
    const rootElement = document.createElement("div");
    document.body.appendChild(rootElement);
    const states = new Map();
    const debuggerMessages = [];
    const instance = {
        data: {},
        canvas: {
            0: rootElement,
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
            ext_table_of_contents: true,
            ext_heading: true,
            headings: "1,2,3,4,5,6",
            initialContent: autoBinding ? "" : content,
            autobinding: autoBinding ? content : "",
            content_is_json: false,
            isEditable: true,
            collab_active: false,
            bubble: {
                auto_binding: () => autoBinding,
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

const initial = await makeHarness();
assert.equal(initial.states.get("is_ready"), true);
assert.deepEqual(headingTexts(initial.states), ["Alpha", "Details"]);

initial.properties.initialContent = DOC_B;
update(initial.instance, initial.properties, initial.context);
await window.happyDOM.whenAsyncComplete();
assert.deepEqual(headingTexts(initial.states), ["Beta", "Other"]);
initial.instance.data.teardownEditor("test");

const autobound = await makeHarness({ autoBinding: true });
assert.deepEqual(headingTexts(autobound.states), ["Alpha", "Details"]);
autobound.instance.data.isDebouncingDone = true;
autobound.properties.autobinding = DOC_B;
update(autobound.instance, autobound.properties, autobound.context);
await window.happyDOM.whenAsyncComplete();
assert.deepEqual(headingTexts(autobound.states), ["Beta", "Other"]);
autobound.instance.data.teardownEditor("test");

const actioned = await makeHarness();
assert.deepEqual(headingTexts(actioned.states), ["Alpha", "Details"]);
setContentAction(
    actioned.instance,
    {
        content: DOC_B,
        is_json: false,
        parseOptions_preserveWhitespace: "false",
    },
    actioned.context,
);
await window.happyDOM.whenAsyncComplete();
assert.deepEqual(headingTexts(actioned.states), ["Beta", "Other"]);
actioned.instance.data.teardownEditor("test");

console.log(JSON.stringify({
    initialLoad: ["Alpha", "Details"],
    initialContentSwitch: ["Beta", "Other"],
    autobindingSwitch: ["Beta", "Other"],
    setContentAction: ["Beta", "Other"],
}));
