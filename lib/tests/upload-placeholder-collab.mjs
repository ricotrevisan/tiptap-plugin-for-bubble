import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Window } from "happy-dom";

// DEF-1927: an upload placeholder in a collaborative editor stays where the file was
// dropped when another collaborator edits meanwhile. y-tiptap applies every remote change
// as a whole-document replace, which maps positions to the start; chips keep a Yjs
// relative position for that case. Two sessions on an in-memory Liveblocks room.

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


const a = await makeEditor("Ada", { ext_link: true, insert_file_links: true });
const b = await makeEditor("Grace");
a.editor.commands.setContent("<p>Alpha</p><p>Omega</p>", true);
await settle();
assert.equal(b.editor.getText(), "Alpha\n\nOmega", "content is shared");

const pending = {};
Object.assign(a.instance, { canUploadFile: () => true, uploadFile: (file, callback) => { pending[file.name] = callback; } });

// Paste a file with the cursor inside "Omega" (Om|ega).
let omega = null;
a.editor.state.doc.descendants((node, pos) => { if (node.isText && node.text === "Omega") omega = pos; });
a.editor.commands.setTextSelection(omega + 2);
const fileProps = a.editor.state.plugins.find((plugin) => plugin.key.startsWith("fileDropAndPaste")).props;
const file = new window.File(["%PDF"], "p.pdf", { type: "application/pdf" });
fileProps.handlePaste(a.editor.view, { clipboardData: { files: [file], types: ["Files"] }, preventDefault() {}, stopPropagation() {} });
await settle();
const chip = () => a.editor.state.plugins.find((plugin) => plugin.key.startsWith("uploadPlaceholders")).getState(a.editor.state)[0];
assert.ok(chip(), "a placeholder is shown");
assert.ok(chip().rel, "the placeholder keeps a Yjs position");
assert.equal(a.states.get("files_uploading"), 1);

// The other collaborator types at the start of the document.
b.editor.commands.insertContentAt(1, "Remote. ");
await settle();
assert.equal(a.editor.getText(), "Remote. Alpha\n\nOmega", "the remote edit arrived");
const at = chip().pos;
assert.equal(a.editor.state.doc.textBetween(at - 2, at), "Om", "the placeholder stays where the file was pasted");

pending["p.pdf"](null, "https://files.test/p.pdf");
await settle();
assert.equal(a.states.get("files_uploading"), 0);
assert.match(a.editor.getHTML(), /<p>Om<a [^>]*href="https:\/\/files.test\/p.pdf"[^>]*>p.pdf<\/a> ega<\/p>/, "the file lands where it was pasted");
assert.match(b.editor.getHTML(), />p.pdf<\/a> ega<\/p>/, "and collaborators see it there");

a.close();
b.close();
console.log("upload placeholder collaboration: all checks passed");
process.exit(0);
