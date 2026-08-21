import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Window } from "happy-dom";

// Regression test for GitHub issue #20:
// A hidden Floating Menu must never become hit-testable after resize/scroll.
// Runs through the real plugin initialization seam (initialize.js + dist.js).

const libRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = resolve(libRoot, "..");
const window = new Window({ url: "https://example.test" });

Object.assign(globalThis, {
    window,
    document: window.document,
    Node: window.Node,
    Element: window.Element,
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

const wait = (ms) => new Promise((resolve_) => setTimeout(resolve_, ms));

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

function snapshot(el) {
    return {
        connected: el.isConnected,
        visibility: el.style.visibility,
        opacity: el.style.opacity,
        pointerEvents: el.style.pointerEvents || "(default)",
    };
}

// A menu element is only safe while it is detached/invisible AND non-interactive.
// Floating UI may flip visibility back to "visible" while logically hidden; that is
// harmless as long as opacity stays 0 and pointer events stay disabled.
function isNonInteractive(el) {
    const detached = !el.isConnected;
    const invisible =
        detached ||
        el.style.visibility === "hidden" ||
        parseFloat(el.style.opacity ?? "1") === 0;
    const inert = el.style.pointerEvents === "none";
    return invisible && inert;
}

// Menu group elements, as a Bubble app would provide them.
const bubbleGroup = document.createElement("div");
bubbleGroup.id = "regression-bubble-menu";
bubbleGroup.textContent = "B";
document.body.appendChild(bubbleGroup);
const floatingGroup = document.createElement("div");
floatingGroup.id = "regression-floating-menu";
floatingGroup.textContent = "F";
document.body.appendChild(floatingGroup);

const h = await makeHarness({
    bubbleMenu: "regression-bubble-menu",
    floatingMenu: "regression-floating-menu",
});
assert.equal(h.states.get("is_ready"), true);

const editor = h.instance.data.editor;
const bubbleEl = bubbleGroup;
const floatEl = floatingGroup;

// ── Initial state: both menus initialized hidden and non-interactive ──
for (const [name, el] of [["bubble", bubbleEl], ["floating", floatEl]]) {
    const s = snapshot(el);
    assert.equal(s.connected, true, `${name} menu should stay connected`);
    assert.equal(s.visibility, "hidden", `${name} menu should start hidden`);
    assert.equal(s.opacity, "0", `${name} menu should start transparent`);
    assert.equal(s.pointerEvents, "none", `${name} menu must not intercept clicks`);
}

// Editor starts on a non-empty paragraph, so Floating Menu shouldShow is false.
assert.equal(
    editor.state.selection.empty,
    true,
    "selection starts empty",
);

// ── Resize must not expose an invisible hit box (60 ms positioning debounce) ──
window.dispatchEvent(new window.Event("resize"));
await wait(200); // debounce (60 ms) + async Floating UI positioning

assert.equal(
    isNonInteractive(floatEl),
    true,
    `floating menu after resize: ${JSON.stringify(snapshot(floatEl))}`,
);
assert.equal(
    isNonInteractive(bubbleEl),
    true,
    `bubble menu control after resize: ${JSON.stringify(snapshot(bubbleEl))}`,
);

// ── Scroll must behave the same ──
window.dispatchEvent(new window.Event("scroll"));
await wait(200);

assert.equal(
    isNonInteractive(floatEl),
    true,
    `floating menu after scroll: ${JSON.stringify(snapshot(floatEl))}`,
);

// ── An eligible empty line still shows the Floating Menu, interactive ──
editor.commands.setContent("");
editor.commands.focus("end");
await window.happyDOM.whenAsyncComplete();

// Force the documented updatePosition/show path if focus-based shouldShow
// cannot resolve in happy-dom (no real layout/focus).
if (floatEl.style.visibility !== "visible") {
    editor.view.dispatch(editor.state.tr.setMeta("floatingMenu", "show"));
    await window.happyDOM.whenAsyncComplete();
}

{
    const s = snapshot(floatEl);
    assert.equal(s.visibility, "visible", "floating menu shows on eligible empty line");
    assert.equal(s.opacity, "1", "floating menu is fully opaque when shown");
    assert.notEqual(s.pointerEvents, "none", "shown floating menu is clickable");
}

// ── Hiding restores a non-interactive state ──
editor.commands.setContent("<p>back to text</p>");
await window.happyDOM.whenAsyncComplete();

assert.equal(
    isNonInteractive(floatEl),
    true,
    `floating menu after hide: ${JSON.stringify(snapshot(floatEl))}`,
);

h.instance.data.teardownEditor("test");

console.log(
    JSON.stringify({
        initialHiddenAndInert: true,
        resizeDoesNotExposeHitBox: true,
        scrollDoesNotExposeHitBox: true,
        showsOnEmptyLineInteractive: true,
        hidesBackToInert: true,
        bubbleMenuControlOk: true,
    }),
);
