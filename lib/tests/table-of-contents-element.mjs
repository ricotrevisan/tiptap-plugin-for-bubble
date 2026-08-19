import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Window } from "happy-dom";

const root = resolve(import.meta.dirname, "../..");
const elementRoot = resolve(root, "src/elements/table-of-contents-toc_element");
const metadata = JSON.parse(readFileSync(resolve(elementRoot, "toc_element.json"), "utf8"));
const initialize = new Function("instance", "context", readFileSync(resolve(elementRoot, "initialize.js"), "utf8"));
const update = new Function("instance", "properties", "context", readFileSync(resolve(elementRoot, "update.js"), "utf8"));
const reset = new Function("instance", "context", readFileSync(resolve(elementRoot, "reset.js"), "utf8"));

const window = new Window({ url: "https://example.com" });
globalThis.window = window;
globalThis.document = window.document;

function makeHarness() {
    const rootElement = document.createElement("div");
    document.body.appendChild(rootElement);
    const states = new Map();
    const events = [];
    const instance = {
        canvas: {
            0: rootElement,
            get: () => rootElement,
            append: (child) => rootElement.append(child),
            empty: () => rootElement.replaceChildren(),
        },
        data: {},
        publishState: (name, value) => states.set(name, value),
        triggerEvent: (name) => events.push({ name, clickedId: states.get("clicked_heading_id") }),
    };
    const debuggerMessages = [];
    const context = { reportDebugger: (message) => debuggerMessages.push(message) };
    initialize(instance, context);
    return { instance, rootElement, states, events, debuggerMessages, context };
}

function properties(overrides = {}) {
    return {
        contents_json: "[]",
        accessible_label: "On this page",
        indent_px: 16,
        item_gap_px: 4,
        auto_scroll: true,
        scroll_behavior: "smooth",
        scroll_block: "start",
        normal_color: "rgb(15, 23, 42)",
        scrolled_over_color: "rgb(100, 116, 139)",
        active_color: "rgb(79, 70, 229)",
        active_background: "rgba(79, 70, 229, 0.12)",
        active_font_weight: "600",
        active_indicator_width: 3,
        ...overrides,
    };
}

assert.equal(metadata.display, "Tiptap Table of Contents");
assert.equal(metadata.fields.contents_json.name, "contents_json");
assert.equal(metadata.fields.normal_color.name, "normal_color");
assert.equal(metadata.fields.scrolled_over_color.name, "scrolled_over_color");
assert.equal(metadata.fields.active_font_weight.name, "active_font_weight");
assert.equal(metadata.fields.active_indicator_width.name, "active_indicator_width");
assert.equal(metadata.states.error_message, undefined);
assert.equal(metadata.events.contents_error, undefined);

const harness = makeHarness();
update(harness.instance, properties({
    contents_json: JSON.stringify([
        { id: "intro", textContent: "Introduction", level: 1, isActive: false, isScrolledOver: true },
        { id: "setup", textContent: "Setup", level: 2, isActive: true, isScrolledOver: true },
        { id: "usage", textContent: "Usage", level: 1, isActive: false, isScrolledOver: false },
    ]),
}), harness.context);

const nav = harness.rootElement.querySelector("nav");
assert.equal(nav.getAttribute("aria-label"), "On this page");
assert.equal(nav.querySelectorAll("a").length, 3);
assert.equal(nav.querySelectorAll("ul").length, 2);
assert.equal(nav.querySelector('a[data-heading-id="setup"]').textContent, "Setup");
assert.equal(nav.querySelector('a[data-heading-id="setup"]').getAttribute("aria-current"), "location");
const nestedList = nav.querySelector("ul ul");
assert.equal(window.getComputedStyle(nestedList).marginBlockStart, "4px");
assert.equal(window.getComputedStyle(nav.querySelector('a[data-heading-id="intro"]')).color, "rgb(100, 116, 139)");
assert.equal(window.getComputedStyle(nav.querySelector('a[data-heading-id="setup"]')).fontWeight, "600");

// State-only updates keep the focused/clickable DOM stable.
const setupAnchor = nav.querySelector('a[data-heading-id="setup"]');
update(harness.instance, properties({
    contents_json: JSON.stringify([
        { id: "intro", textContent: "Introduction", level: 1, isActive: true, isScrolledOver: true },
        { id: "setup", textContent: "Setup", level: 2, isActive: false, isScrolledOver: true },
        { id: "usage", textContent: "Usage", level: 1, isActive: false, isScrolledOver: false },
    ]),
}), harness.context);
assert.equal(harness.rootElement.querySelector('a[data-heading-id="setup"]'), setupAnchor);
assert.equal(harness.rootElement.querySelector('a[data-heading-id="intro"]').getAttribute("aria-current"), "location");

// Clicking publishes the ID before the event and scrolls with the configured options.
const targetHeading = document.createElement("h2");
targetHeading.id = "setup";
let scrollOptions = null;
targetHeading.scrollIntoView = (options) => { scrollOptions = options; };
document.body.appendChild(targetHeading);
setupAnchor.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
assert.equal(harness.states.get("clicked_heading_id"), "setup");
assert.deepEqual(harness.events.at(-1), { name: "heading_clicked", clickedId: "setup" });
assert.deepEqual(scrollOptions, { behavior: "smooth", block: "start" });

// Heading text is always rendered as text, never as markup.
update(harness.instance, properties({
    contents_json: JSON.stringify([
        { id: "safe", textContent: "<img src=x onerror=alert(1)>", level: 1 },
    ]),
}), harness.context);
assert.equal(harness.rootElement.querySelector("a").textContent, "<img src=x onerror=alert(1)>");
assert.equal(harness.rootElement.querySelector("img"), null);

// Empty and invalid input clear stale navigation without adding public error state.
update(harness.instance, properties({ contents_json: "[]" }), harness.context);
assert.equal(harness.rootElement.querySelector("nav"), null);
update(harness.instance, properties({ contents_json: "not json" }), harness.context);
update(harness.instance, properties({ contents_json: "not json" }), harness.context);
assert.equal(harness.rootElement.querySelector("nav"), null);
assert.equal(harness.states.has("error_message"), false);
assert.equal(harness.events.some(({ name }) => name === "contents_error"), false);
assert.equal(harness.debuggerMessages.length, 1);
update(harness.instance, properties({ contents_json: "[]" }), harness.context);

// Auto-scroll can be disabled without suppressing the Bubble event.
const eventOnly = makeHarness();
update(eventOnly.instance, properties({
    auto_scroll: false,
    contents_json: JSON.stringify([{ id: "setup", textContent: "Setup", level: 1 }]),
}), eventOnly.context);
scrollOptions = null;
eventOnly.rootElement.querySelector("a").dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
assert.equal(scrollOptions, null);
assert.deepEqual(eventOnly.events.at(-1), { name: "heading_clicked", clickedId: "setup" });
reset(eventOnly.instance, eventOnly.context);

const ownedRoot = harness.instance.data.tocRoot;
const eventCountBeforeReset = harness.events.length;
reset(harness.instance, harness.context);
const cleanupProbe = document.createElement("a");
cleanupProbe.dataset.headingId = "setup";
ownedRoot.appendChild(cleanupProbe);
cleanupProbe.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
assert.equal(harness.events.length, eventCountBeforeReset);

console.log(JSON.stringify({
    semanticNestedOutline: true,
    activeUpdatesPreserveDom: true,
    clickEventAndAutoScrollWork: true,
    invalidInputFailsSafely: true,
    resetCleansUp: true,
}));
