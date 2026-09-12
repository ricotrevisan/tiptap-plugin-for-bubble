import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Window } from "happy-dom";

// WTF-245 / WTF-255: Bubble owns menu nodes across editor generations.
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

const update = new Function("instance", "properties", "context",
    readFileSync(resolve(root, "src/elements/tiptap-AAC/update.js"), "utf8"));

async function makeHarness(propertyOverrides = {}, container = document.body) {
    const rootElement = document.createElement("div");
    container.appendChild(rootElement);
    const states = new Map();
    const messages = [];
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
    const context = { reportDebugger(message) { messages.push(message); } };
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
    await wait(80);
    return { instance, states, properties, context, messages };
}

function snapshot(el) {
    return {
        connected: el.isConnected,
        visibility: el.style.visibility,
        opacity: el.style.opacity,
        pointerEvents: el.style.pointerEvents || "(default)",
    };
}

// Preserve Bubble-owned groups through actual extension show/hide and teardown.
for (const type of ["bubbleMenu", "floatingMenu"]) {
    for (const visible of [false, true]) {
        const parent = document.createElement("section");
        const menu = document.createElement("div");
        const sibling = document.createElement("span");
        menu.id = `${type}-${visible}`;
        menu.setAttribute("style", "color: red; position: relative;");
        menu.setAttribute("tabindex", "3");
        parent.append(menu, sibling);
        document.body.append(parent);
        const originalStyle = menu.getAttribute("style");
        const h = await makeHarness({ [type]: menu.id });
        const editor = h.instance.data.editor;
        editor.view.dispatch(editor.state.tr.setMeta(type, "show"));
        await wait(80);
        assert.equal(menu.parentNode?.parentNode === document.body, true);
        if (!visible) {
            editor.view.dispatch(editor.state.tr.setMeta(type, "hide"));
            await wait(80);
        }
        h.instance.data.teardownEditor("regression");
        assert.equal(menu.parentNode === parent, true, `${type} must return to its Bubble parent`);
        assert.equal(menu.nextSibling === sibling, true);
        assert.equal(menu.getAttribute("style"), originalStyle);
        assert.equal(menu.getAttribute("tabindex"), "3");
        await wait(100);
        assert.equal(menu.getAttribute("style"), originalStyle, "late positioning must not change restored style");
        h.instance.data.teardownEditor("repeat");
        h.instance.data.setupEditor(h.properties, h.context);
        await wait(80);
        h.instance.data.editor.view.dispatch(h.instance.data.editor.state.tr.setMeta(type, "show"));
        await wait(80);
        assert.equal(menu.parentNode?.parentNode === document.body, true, "rebuild reuses the same node");
        h.instance.data.teardownEditor("done");
        parent.remove();
    }
}
function makeMenu(id, parent = document.body) {
    const node = document.createElement("div");
    node.id = id;
    parent.append(node);
    return node;
}
async function change(h, values) {
    Object.assign(h.properties, values);
    update(h.instance, h.properties, h.context);
    await wait(80);
}

// One node cannot be leased by both menu kinds or by competing editors.
const shared = makeMenu("shared:menu[1]");
const owner = await makeHarness({ bubbleMenu: shared.id, floatingMenu: shared.id });
assert.equal(owner.instance.data._menuLeases.length, 1);
assert.ok(owner.messages.some((message) => message.includes("already owned")));
const contender = await makeHarness({ bubbleMenu: shared.id });
assert.equal(contender.instance.data._menuLeases.length, 0);
assert.ok(contender.messages.some((message) => message.includes("already owned")));
contender.instance.data.teardownEditor("non-owner");
assert.equal(owner.instance.data._menuLeases[0].active, true);
const oldLease = owner.instance.data._menuLeases[0];
owner.instance.data.teardownEditor("release");
contender.instance.data.setupEditor(contender.properties, contender.context);
await wait(80);
oldLease.release();
assert.equal(contender.instance.data._menuLeases[0].active, true, "stale release cannot release the next owner");
contender.instance.data.teardownEditor("done");
assert.equal(shared.hasAttribute("style"), false);
assert.equal(shared.hasAttribute("tabindex"), false);
shared.remove();

// Duplicate IDs resolve in the editor's own reusable, even while portalled.
const rows = [document.createElement("section"), document.createElement("section")];
rows.forEach((row) => document.body.append(row));
const menus = rows.map((row) => makeMenu("duplicate.menu", row));
const editors = [];
for (const row of rows) editors.push(await makeHarness({ bubbleMenu: "duplicate.menu" }, row));
for (const [index, h] of editors.entries()) {
    assert.equal(h.instance.data._menuLeases[0].node === menus[index], true);
    h.instance.data.editor.view.dispatch(h.instance.data.editor.state.tr.setMeta("bubbleMenu", "show"));
}
await wait(80);
for (const [index, h] of editors.entries()) {
    assert.equal(h.instance.data.resolveMenu("duplicate.menu") === menus[index], true);
    h.instance.data.teardownEditor("done");
}
rows.forEach((row) => row.remove());

// Configuration rebuilds preserve local content and reacquire current Bubble nodes.
const parent = document.createElement("section");
document.body.append(parent);
let menu = makeMenu("changing-menu", parent);
const second = makeMenu("second-menu", parent);
const h = await makeHarness({ floatingMenu: menu.id, ext_ai_toolkit: false });
h.instance.data.editor.commands.setContent("<p>Unsaved local text</p>");
for (const values of [
    { ext_ai_toolkit: true },
    { ext_ai_toolkit: false },
    { floatingMenu: second.id },
    { ext_floatingmenu: false },
    { ext_floatingmenu: true },
]) {
    const before = h.instance.data.editor;
    await change(h, values);
    assert.notEqual(h.instance.data.editor, before);
    assert.equal(h.instance.data.editor.getHTML(), "<p>Unsaved local text</p>");
}
const oldNode = second;
oldNode.remove();
menu = makeMenu("second-menu", parent);
await change(h, {});
assert.equal(h.instance.data._menuLeases[0].node === menu, true, "replaced node is reacquired");
assert.equal(oldNode.isConnected, false, "replaced node must not be resurrected");

// Removing a reusable while its menu is shown must not resurrect stale DOM.
h.instance.data.editor.view.dispatch(h.instance.data.editor.state.tr.setMeta("floatingMenu", "show"));
await wait(80);
parent.remove();
h.instance.data.teardownEditor("reusable removed");
assert.equal(menu.isConnected, false);
const replacementParent = document.createElement("section");
document.body.append(replacementParent);
const replacement = makeMenu("second-menu", replacementParent);
h.instance.data.setupEditor(h.properties, h.context);
await wait(80);
assert.equal(h.instance.data._menuLeases[0].node === replacement, true);
h.instance.data.teardownEditor("done");
replacementParent.remove();
// Drive the real collaboration document-change update branch with networking
// stubbed at the provider seam; menu plugins and editor teardown remain real.
const collabMenu = makeMenu("collab-menu");
const c = await makeHarness({ bubbleMenu: collabMenu.id });
c.instance.data.maybeSetupCollaboration = () => {};
c.instance.data._currentCollabDocId = "document-a";
const beforeCollab = c.instance.data.editor;
await change(c, { collab_active: true, collab_jwt: "fixture", collab_doc_id: "document-b" });
assert.notEqual(c.instance.data.editor, beforeCollab);
assert.equal(c.instance.data._menuLeases[0].node === collabMenu, true);
c.instance.data.teardownEditor("authentication retry");
c.instance.data.setupEditor(c.properties, c.context);
await wait(80);
assert.equal(c.instance.data._menuLeases[0].node === collabMenu, true);
c.instance.data.teardownEditor("done");
collabMenu.remove();

// A setup failure after acquisition must return the Group and release ownership.
const failedMenu = makeMenu("failed-menu");
const f = await makeHarness();
f.instance.data.teardownEditor("prepare failure");
f.instance.data.maybeSetupCollaboration = () => { throw new Error("fixture provider failure"); };
f.properties.bubbleMenu = failedMenu.id;
const originalError = console.error;
try {
    console.error = () => {};
    f.instance.data.setupEditor(f.properties, f.context);
} finally {
    console.error = originalError;
}
assert.equal(f.instance.data._menuLeases.length, 0);
assert.equal(failedMenu.hasAttribute("style"), false);
assert.equal(failedMenu.parentNode === document.body, true);
failedMenu.remove();
// Teardown can run before Floating UI positioning promises have settled.
for (const type of ["bubbleMenu", "floatingMenu"]) {
    const node = makeMenu(`pending-${type}`);
    const pending = await makeHarness({ [type]: node.id });
    pending.instance.data.editor.view.dispatch(pending.instance.data.editor.state.tr.setMeta(type, "show"));
    pending.instance.data.teardownEditor("immediate teardown");
    await wait(100);
    assert.equal(node.hasAttribute("style"), false, `${type}: pending positioning must not mutate released nodes`);
    node.remove();
}
console.log("Menu ownership lifecycle passed");
