import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Window } from "happy-dom";

// WTF-248: Liveblocks publishes real sync/status/presence state and owns its
// room, subscriptions and Y.Doc. Runs the installed LiveblocksYjsProvider
// against an in-memory Liveblocks service with two editor sessions.

const libRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = resolve(libRoot, "..");
const window = new Window({ url: "https://example.test" });
Object.assign(globalThis, {
    window, document: window.document, Node: window.Node, Element: window.Element, HTMLElement: window.HTMLElement,
    ShadowRoot: window.ShadowRoot, MutationObserver: window.MutationObserver,
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
const metadata = JSON.parse(readFileSync(resolve(root, "src/elements/tiptap-AAC/AAC.json"), "utf8"));
const defaults = Object.fromEntries(Object.values(metadata.fields).map(field => [field.name, field.default_val]));

const tiptap = window.tiptap;
const service = createFakeLiveblocks(tiptap.Y);
tiptap.createClient = options => service.createClient(options);
const documents = [];
tiptap.LiveblocksProvider = class extends tiptap.LiveblocksProvider {
    constructor(room, document) {
        super(room, document);
        const record = { document, destroys: 0 };
        // Y.Doc drops its listeners on destroy; count calls, not events.
        const destroy = document.destroy.bind(document);
        document.destroy = () => { record.destroys++; destroy(); };
        documents.push(record);
    }
};

const settle = () => window.happyDOM.whenAsyncComplete();

async function makeEditor(name, overrides = {}) {
    const canvas = document.createElement("div");
    document.body.appendChild(canvas);
    const states = new Map(), events = [], messages = [];
    const instance = {
        data: {},
        canvas: { 0: canvas, css() {}, append: node => canvas.appendChild(node), parent: () => ({ length: 0 }), height() {} },
        publishState: (key, value) => states.set(key, value),
        triggerEvent: event => events.push(event),
        publishAutobinding() {}, canUploadFile: () => true, uploadFile() {},
    };
    const context = { reportDebugger: message => messages.push(String(message)) };
    initialize(instance, context);
    const properties = {
        ...defaults, initialContent: "<p>Seed</p>", content_is_json: false, isEditable: true,
        collab_active: true, collabProvider: "liveblocks", liveblocksPublicApiKey: "pk_test",
        collab_doc_id: "room-1", collab_jwt: "", collab_user_name: name,
        ...overrides,
        bubble: { auto_binding: () => false, fit_height: () => false, font_size: () => 16,
            font_color: () => "#111111", font_face: () => "Arial:400" },
    };
    const h = {
        instance, properties, states, events, messages,
        get editor() { return instance.data.editor; },
        get session() { return service.history.findLast(session => !session.left && session.presence.__yjs?.user?.name === name); },
        async change(values = {}) {
            Object.assign(properties, values);
            update(instance, properties, context);
            await settle();
        },
        count: event => events.filter(value => value === event).length,
        close() { instance.data.teardownEditor("test complete"); canvas.remove(); },
    };
    await h.change();
    return h;
}

// 1. Sync that arrives after the 10-second polling fallback still marks the
//    document synced and seeds the empty room exactly once.
service.holdSync = true;
const a = await makeEditor("Ada");
assert.equal(a.states.get("is_ready"), true);
assert.equal(a.states.get("collab_status"), "connected");
assert.equal(a.states.get("collab_synced"), false);
assert.equal(a.editor.getText(), "", "an unsynced room is not seeded");
clearInterval(a.instance.data._collabSyncPollInterval); // polling window elapsed
a.instance.data._collabSyncPollInterval = null;
service.flushSync();
await settle();
assert.equal(a.instance.data.collabHasSynced, true);
assert.equal(a.states.get("collab_synced"), true);
assert.equal(a.count("collab_synced"), 1);
assert.equal(a.editor.getText(), "Seed", "late sync seeds the new room");

// 2. A second session joins the same room: it receives the shared document,
//    does not seed it again, and both see two connected users.
const b = await makeEditor("Grace");
assert.equal(b.states.get("collab_synced"), true);
assert.equal(b.editor.getText(), "Seed", "existing room content is not duplicated");
assert.equal(a.states.get("collab_connected_users"), 2);
assert.equal(b.states.get("collab_connected_users"), 2);
a.editor.commands.insertContentAt(a.editor.state.doc.content.size - 1, " shared");
await settle();
assert.equal(b.editor.getText(), "Seed shared", "edits reach the other session");

// 3. Disconnects publish a non-synced state; reconnects resync, including
//    edits made while offline.
const aSession = a.session;
aSession.drop();
await settle();
assert.equal(a.states.get("collab_status"), "connecting");
assert.equal(a.states.get("collab_synced"), false);
assert.equal(a.instance.data.collabHasSynced, false);
assert.equal(b.states.get("collab_connected_users"), 1, "presence reflects the dropped session");
a.editor.commands.insertContentAt(a.editor.state.doc.content.size - 1, " offline");
await settle();
assert.equal(b.editor.getText(), "Seed shared");
aSession.connect();
await settle();
assert.equal(a.states.get("collab_status"), "connected");
assert.equal(a.states.get("collab_synced"), true);
assert.equal(a.count("collab_synced"), 2);
assert.equal(b.editor.getText(), "Seed shared offline", "offline edits sync after reconnect");
assert.equal(b.states.get("collab_connected_users"), 2);

// 4. Repeated room switches leave each room once, destroy each provider-owned
//    Y.Doc once, and never carry content between rooms.
for (let round = 2; round <= 5; round++) {
    const previousDocuments = documents.length;
    const leftBefore = service.left;
    await a.change({ collab_doc_id: `room-${round}` });
    assert.equal(service.left, leftBefore + 1, `room switch ${round} leaves one room`);
    assert.equal(service.sessions.size, 2, "one live session per editor");
    assert.equal(documents.length, previousDocuments + 1);
    assert.equal(a.states.get("collab_synced"), true);
    assert.equal(a.editor.getText(), "Seed", `room-${round} starts from its own content`);
    a.editor.commands.insertContentAt(a.editor.state.doc.content.size - 1, ` r${round}`);
    await settle();
}
assert.equal(b.editor.getText(), "Seed shared offline", "the other room is untouched");
await a.change({ collab_doc_id: "room-1" });
assert.equal(a.editor.getText(), "Seed shared offline", "returning to a room loads its shared state");
assert.equal(service.left, 5);

// 5. Obsolete provider and room callbacks cannot publish into the new session.
//    The fake delivers them to listeners that were already unsubscribed.
const staleSession = service.history[service.history.length - 2];
assert.ok(staleSession.left && staleSession.roomId.endsWith("room-5"));
const statesBefore = new Map(a.states);
const eventsBefore = a.events.length;
staleSession.events.status.deliverLate("reconnecting");
staleSession.events.others.deliverLate({ type: "leave", user: { connectionId: 0, presence: {} }, others: [] });
staleSession.events.myPresence.deliverLate({});
staleSession.events.error.deliverLate(new Error("stale"));
assert.deepEqual(a.states, statesBefore);
assert.equal(a.events.length, eventsBefore);
assert.deepEqual(a.messages, []);

// 6. Connection errors are reported once per connection attempt, without the
//    raw provider message.
const error = Object.assign(new Error("room room-1 secret detail"), { context: { type: "ROOM_CONNECTION_ERROR", code: 4001 } });
a.session.events.error.notify(error);
a.session.events.error.notify(error);
assert.deepEqual(a.messages, ["Liveblocks connection error (code 4001). Check the public API key and the room's permissions."]);
a.session.drop();
a.session.connect();
await settle();
a.session.events.error.notify(error);
assert.equal(a.messages.length, 2, "a new connection attempt can report again");
a.messages.length = 0;

// 7. Teardown is idempotent: rooms are left, subscriptions released and each
//    Y.Doc destroyed exactly once.
a.close();
a.instance.data.teardownEditor("repeated teardown");
b.close();
assert.equal(service.sessions.size, 0);
assert.equal(service.left, service.entered);
assert.equal(service.history.reduce((total, session) =>
    total + Object.values(session.events).reduce((sum, events) => sum + events.size, 0), 0), 0);
assert.ok(documents.every(record => record.destroys === 1), "each Y.Doc destroyed once");
assert.equal(a.states.get("collab_status"), "disconnected");
assert.equal(a.states.get("collab_synced"), false);
assert.equal(a.states.get("collab_connected_users"), 0);
assert.deepEqual([...a.messages, ...b.messages], []);

console.log("Liveblocks lifecycle passed");
