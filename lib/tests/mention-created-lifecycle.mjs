import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Window } from "happy-dom";

// WTF-261: Mention created fires once per local suggestion acceptance, after
// publishing the new mention's ID, label and trigger character. Paste,
// undo/redo, loaded content, programmatic and remote changes never fire.
// Contract: docs/wtf-261/event-contract.md.

const libRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = resolve(libRoot, "..");
const window = new Window({ url: "https://example.test" });
Object.assign(globalThis, {
    window, document: window.document, Node: window.Node, Element: window.Element, HTMLElement: window.HTMLElement,
    ShadowRoot: window.ShadowRoot, MutationObserver: window.MutationObserver, ClipboardEvent: window.ClipboardEvent,
    DOMParser: window.DOMParser, getComputedStyle: window.getComputedStyle.bind(window),
    requestAnimationFrame: callback => setTimeout(() => callback(Date.now()), 0),
    cancelAnimationFrame: clearTimeout,
});
Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true });
await import(pathToFileURL(resolve(libRoot, "dist.js")));
const { createFakeLiveblocks } = await import("./support/fake-liveblocks.mjs");

const source = name => readFileSync(resolve(root, `src/elements/tiptap-AAC/${name}.js`), "utf8");
const initialize = new Function("instance", "context", source("initialize"));
const update = new Function("instance", "properties", "context", source("update"));
const setContent = new Function("instance", "properties", "context", source("actions/set-content-ACW"));
const reset = new Function("instance", "context", source("reset"));
const clearContents = new Function("instance", "properties", "context", source("actions/clear-contents-ABp"));
const metadata = JSON.parse(readFileSync(resolve(root, "src/elements/tiptap-AAC/AAC.json"), "utf8"));
const defaults = Object.fromEntries(Object.values(metadata.fields).map(field => [field.name, field.default_val]));

const service = createFakeLiveblocks(window.tiptap.Y);
window.tiptap.createClient = options => service.createClient(options);

const settle = () => window.happyDOM.whenAsyncComplete();
const thing = values => ({ get: key => values[key] });
const list = items => ({ length: () => items.length, get: (start, count) => items.slice(start, start + count) });
const people = list([thing({ name: "Ada Lovelace", uid: "ada" }), thing({ name: "Grace Hopper", uid: 42 })]);
const MENTION_STATES = ["mentioned_id", "mentioned_label", "mentioned_trigger_char"];

async function makeEditor({ autoBinding = false, ...overrides } = {}) {
    const canvas = document.createElement("div");
    document.body.appendChild(canvas);
    const states = new Map(), events = [], messages = [];
    const instance = {
        data: {},
        canvas: { 0: canvas, css() {}, append: node => canvas.appendChild(node), parent: () => ({ length: 0 }), height() {} },
        publishState: (key, value) => states.set(key, value),
        // Snapshot mention states when each event fires: workflows read them then.
        triggerEvent: name => events.push({ name, states: Object.fromEntries(MENTION_STATES.map(key => [key, states.get(key)])) }),
        publishAutobinding() {}, canUploadFile: () => true, uploadFile() {},
    };
    const context = { reportDebugger: message => messages.push(String(message)) };
    initialize(instance, context);
    const properties = {
        ...defaults, initialContent: "<p>Hello</p>", content_is_json: false, isEditable: true,
        collab_active: false, ext_history: true,
        ext_mention: true, mention_list: people, mention_field_label: "name", mention_field_id: "uid",
        mention_triggerChar: "@", mention_base_url: "https://example.test/user/",
        ...overrides,
        bubble: { auto_binding: () => autoBinding, fit_height: () => false, font_size: () => 16,
            font_color: () => "#111111", font_face: () => "Arial:400" },
    };
    const h = {
        instance, properties, states, events, messages, context,
        get editor() { return instance.data.editor; },
        created: () => events.filter(event => event.name === "mention_created"),
        async change(values = {}) {
            Object.assign(properties, values);
            update(instance, properties, context);
            await settle();
        },
        // Type at the end of the document; the suggestion plugin reacts to the
        // resulting state exactly as it does to keyboard input.
        async type(text) {
            h.editor.commands.focus("end");
            h.editor.commands.insertContent(text);
            await settle();
        },
        async press(key) {
            const event = new window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
            h.editor.view.someProp("handleKeyDown", handler => handler(h.editor.view, event));
            await settle();
        },
        async click(label) {
            const button = [...document.querySelectorAll(`.items_${instance.data.randomId} .item`)]
                .find(element => element.textContent === label);
            assert.ok(button, `suggestion "${label}" is visible`);
            button.click();
            await settle();
        },
        mentions() {
            const found = [];
            h.editor.state.doc.descendants(node => { if (node.type.name === "mention") found.push({ ...node.attrs }); });
            return found;
        },
        close() { instance.data.teardownEditor("test complete"); canvas.remove(); },
    };
    await h.change();
    assert.equal(states.get("is_ready"), true);
    return h;
}

// 0. States start empty and loading content with mentions does not fire.
const loaded = await makeEditor({
    initialContent: '<p>Hi <span data-type="mention" data-id="ada" data-label="Ada Lovelace"></span></p>',
});
assert.equal(loaded.mentions().length, 1, "initial content contains a mention");
assert.deepEqual(MENTION_STATES.map(key => loaded.states.get(key)), ["", "", ""], "states start empty");
assert.equal(loaded.created().length, 0, "initial content does not fire");
loaded.close();

const a = await makeEditor();
const b = await makeEditor({ mention_triggerChar: "#" });

// 1. Enter after a query (the plugin's own insertion) publishes, then fires once.
await a.type(" @");
await a.type("Ad");
await a.press("Enter");
assert.deepEqual(a.mentions(), [{ id: "ada", label: "Ada Lovelace", mentionSuggestionChar: "@" }],
    "mention JSON is unchanged");
assert.match(a.editor.getHTML(),
    /<a href="https:\/\/example\.test\/user\/ada" data-type="mention" class="mention" data-id="ada" data-label="Ada Lovelace" data-mention-suggestion-char="@">@Ada Lovelace<\/a>/,
    "mention HTML is unchanged");
assert.equal(a.created().length, 1, "suggestion acceptance fires once");
assert.deepEqual(a.created()[0].states,
    { mentioned_id: "ada", mentioned_label: "Ada Lovelace", mentioned_trigger_char: "@" },
    "states are published before the event fires");
assert.equal(b.created().length, 0, "another editor does not fire");
assert.equal(b.states.get("mentioned_id"), "", "another editor's states are untouched");

// 1b. Tab accepts a suggestion without a query and fires once.
await a.type(" @");
await a.press("Tab");
assert.equal(a.mentions().length, 2);
assert.equal(a.created().length, 2, "Tab acceptance fires once");
assert.deepEqual(a.created()[1].states,
    { mentioned_id: "ada", mentioned_label: "Ada Lovelace", mentioned_trigger_char: "@" });

// 1c. Clicking a suggestion fires once; numeric IDs are published as text.
await a.type(" @");
await a.type("Gr");
await a.click("Grace Hopper");
assert.equal(a.created().length, 3, "clicking a suggestion fires once");
assert.deepEqual(a.created()[2].states,
    { mentioned_id: "42", mentioned_label: "Grace Hopper", mentioned_trigger_char: "@" });
assert.equal(a.mentions()[2].id, 42, "mention JSON keeps the original ID value");

// 6. A second editor with a custom trigger character publishes its own values.
await b.type(" #");
await b.type("Gr");
await b.press("Enter");
assert.equal(b.created().length, 1);
assert.deepEqual(b.created()[0].states,
    { mentioned_id: "42", mentioned_label: "Grace Hopper", mentioned_trigger_char: "#" });
assert.equal(a.created().length, 3, "the first editor does not fire for the second");
assert.equal(a.states.get("mentioned_trigger_char"), "@");

// 4. Accepting when nothing matches inserts nothing, publishes nothing and
//    does not fire.
await b.type(" #");
await b.type("zzz");
const unmatched = JSON.stringify(b.editor.getJSON());
await b.press("Enter");
assert.equal(JSON.stringify(b.editor.getJSON()), unmatched, "no matching item leaves the document unchanged");
assert.equal(b.mentions().length, 1, "no empty mention is inserted");
assert.equal(b.created().length, 1, "no matching item does not fire");
assert.equal(b.states.get("mentioned_label"), "Grace Hopper", "states keep the latest created mention");
b.close();

// 5. Undo and redo do not fire, and states keep the latest created mention.
const beforeHistory = a.created().length;
a.editor.commands.undo();
await settle();
assert.ok(a.mentions().length < 3, "undo removed a mention");
a.editor.commands.redo();
await settle();
assert.equal(a.mentions().length, 3, "redo restored a mention");
assert.equal(a.created().length, beforeHistory, "undo/redo do not fire");
assert.equal(a.states.get("mentioned_id"), "42");

// 5. Paste (including a copy of an existing mention) does not fire.
a.editor.commands.focus("end");
a.editor.view.pasteHTML('<p><span data-type="mention" data-id="ada" data-label="Ada Lovelace"></span></p>');
await settle();
assert.equal(a.mentions().length, 4, "paste inserted a mention");
assert.equal(a.created().length, beforeHistory, "paste does not fire");

// 5. Programmatic insertion does not fire.
a.editor.commands.insertContent({ type: "mention", attrs: { id: "grace", label: "Grace Hopper" } });
await settle();
assert.equal(a.mentions().length, 5);
assert.equal(a.created().length, beforeHistory, "programmatic insertion does not fire");

// 5. Drop or move: any transaction inserting a mention outside the
//    suggestion list does not fire, whatever its UI event.
const { state } = a.editor;
a.editor.view.dispatch(state.tr
    .insert(state.doc.content.size - 1, state.schema.nodes.mention.create({ id: "ada", label: "Ada Lovelace" }))
    .setMeta("uiEvent", "drop"));
await settle();
assert.equal(a.mentions().length, 6);
assert.equal(a.created().length, beforeHistory, "drop does not fire");

// 5. Set content with mentions does not fire and keeps the latest states.
setContent(a.instance, {
    content: '<p><span data-type="mention" data-id="ada" data-label="Ada Lovelace"></span></p>',
    is_json: false, parseOptions_preserveWhitespace: "false",
}, a.context);
await settle();
assert.equal(a.mentions().length, 1);
assert.equal(a.created().length, beforeHistory, "Set content does not fire");

// 5. Changing the initial content property and Clear contents do not fire.
await a.change({ initialContent: '<p><span data-type="mention" data-id="grace" data-label="Grace Hopper"></span> and <span data-type="mention" data-id="ada" data-label="Ada Lovelace"></span></p>' });
assert.equal(a.mentions().length, 2, "new initial content was applied");
clearContents(a.instance, {}, a.context);
await settle();
assert.equal(a.mentions().length, 0);
setContent(a.instance, {
    content: '<p><span data-type="mention" data-id="ada" data-label="Ada Lovelace"></span></p>',
    is_json: false, parseOptions_preserveWhitespace: "false",
}, a.context);
await settle();
assert.equal(a.created().length, beforeHistory, "initial content change and Clear contents do not fire");

// 5. A rebuild reloads the draft without firing; states survive it.
await a.change({ ext_table_of_contents: !a.properties.ext_table_of_contents });
assert.equal(a.mentions().length, 1, "rebuild keeps the draft");
assert.equal(a.created().length, beforeHistory, "rebuild does not fire");
assert.equal(a.states.get("mentioned_label"), "Grace Hopper", "states survive a rebuild");

// 5. An element reset rebuilds from initial content without firing.
reset(a.instance, a.context);
await a.change();
assert.equal(a.states.get("is_ready"), true);
assert.ok(a.mentions().length > 0, "reset reloaded content with mentions");
assert.equal(a.created().length, beforeHistory, "reset does not fire");
assert.equal(a.states.get("mentioned_id"), "42", "states survive a reset");

// 8. Mentioning the same person again fires again.
await a.type(" @");
await a.type("Ad");
await a.press("Enter");
assert.equal(a.created().length, beforeHistory + 1, "each acceptance fires");
assert.equal(a.states.get("mentioned_id"), "ada");

// 3. Deleting the created mention and tearing down keep the latest states.
const mentionCount = a.mentions().length;
let lastMention;
a.editor.state.doc.descendants((node, pos) => { if (node.type.name === "mention") lastMention = { pos, size: node.nodeSize }; });
a.editor.view.dispatch(a.editor.state.tr.delete(lastMention.pos, lastMention.pos + lastMention.size));
await settle();
assert.equal(a.mentions().length, mentionCount - 1, "the created mention was deleted");
a.close();
assert.deepEqual(MENTION_STATES.map(key => a.states.get(key)), ["ada", "Ada Lovelace", "@"],
    "deleting the mention and teardown keep the latest states");
assert.equal(a.created().length, beforeHistory + 1);

// 5. Autobinding loads and record switches do not fire.
const mentionHTML = id => `<p><span data-type="mention" data-id="${id}" data-label="${id}"></span></p>`;
const bound = await makeEditor({ autoBinding: true, initialContent: "", autobinding: mentionHTML("ada"),
    autobinding_record_id: "r1", update_delay: 0, autobinding_save_delay: 0 });
assert.equal(bound.mentions()[0]?.id, "ada", "autobinding loaded a mention");
await bound.change({ autobinding: mentionHTML("grace"), autobinding_record_id: "r2" });
assert.equal(bound.mentions()[0]?.id, "grace", "record switch loaded another mention");
assert.equal(bound.created().length, 0, "autobinding loads and record switches do not fire");
bound.close();

// 5. Remote collaboration: the accepting collaborator fires; the other does not.
const collab = { collab_active: true, collabProvider: "liveblocks", liveblocksPublicApiKey: "pk_test",
    collab_doc_id: "mentions", collab_jwt: "", initialContent: "<p>Shared</p>" };
const local = await makeEditor({ ...collab, collab_user_name: "Ada" });
const remote = await makeEditor({ ...collab, collab_user_name: "Grace" });
assert.equal(remote.editor.getText(), "Shared", "both sessions share one document");
await local.type(" @");
await local.type("Gr");
await local.press("Enter");
assert.equal(local.created().length, 1, "the accepting collaborator fires");
assert.equal(remote.mentions().length, 1, "the mention reaches the other collaborator");
assert.equal(remote.created().length, 0, "remote changes do not fire");
assert.equal(remote.states.get("mentioned_id"), "", "remote changes do not publish mention states");
local.close();
remote.close();

console.log(JSON.stringify({
    localAcceptanceFiresOnceAfterStates: true,
    tabAndClickAcceptanceFire: true,
    customTriggerAndInstanceIsolation: true,
    noItemDoesNotFire: true,
    nonSuggestionChangesDoNotFire: true,
    remoteCollaborationDoesNotFire: true,
}));
