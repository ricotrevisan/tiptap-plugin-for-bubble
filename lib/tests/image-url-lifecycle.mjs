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
    KeyboardEvent: window.KeyboardEvent,
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
const action = (name) => new Function("instance", "properties", "context",
    readFileSync(resolve(root, `src/elements/tiptap-AAC/actions/${name}.js`), "utf8"));
const insertImage = action("insert-image-ACD");
const setContent = action("set-content-ACW");
const clearContents = action("clear-contents-ABp");
const update = new Function("instance", "properties", "context",
    readFileSync(resolve(root, "src/elements/tiptap-AAC/update.js"), "utf8"));
const reset = new Function("instance", "context",
    readFileSync(resolve(root, "src/elements/tiptap-AAC/reset.js"), "utf8"));
const settle = () => window.happyDOM.whenAsyncComplete();
const A = "https://example.test/a.png";
const B = "https://example.test/b.png";
const C = "https://example.test/c.png";
const html = (...urls) => '<p>Before</p>' + urls.map((src) => `<img src="${src}">`).join("") + '<p>After</p>';

async function makeHarness(content = html(), overrides = {}, collaborationDocument) {
    const rootElement = document.createElement("div");
    document.body.appendChild(rootElement);
    const states = new Map();
    const events = [];
    const debuggerMessages = [];
    const uploads = [];
    const instance = {
        data: {},
        canvas: {
            css() {},
            append(element) { rootElement.appendChild(element); },
            parent() { return { length: 0 }; },
            height() {},
        },
        publishState(name, value) { states.set(name, Array.isArray(value) ? [...value] : value); },
        triggerEvent(name) {
            events.push({ name, removed: [...(states.get("removed_image_urls") || [])],
                uploads: [...(states.get("fileUploadUrls") || [])] });
        },
        publishAutobinding() {},
        canUploadFile() { return true; },
        uploadFile(file, callback, attachedTo, progress) {
            uploads.push({ file, attachedTo });
            progress(1);
            callback(null, `https://example.test/${file.name}`);
        },
    };
    const context = {
        reportDebugger(message) { debuggerMessages.push(String(message)); },
        reportToDebugger(message) { debuggerMessages.push(String(message)); },
    };
    initialize(instance, context);
    const properties = {
        ...defaults,
        initialContent: content,
        content_is_json: false,
        isEditable: true,
        collab_active: false,
        ext_image: true,
        ext_history: true,
        attachFilesTo: { id: "attachment-owner" },
        bubble: {
            auto_binding: () => false,
            fit_height: () => false,
            font_size: () => 16,
            font_color: () => "#111111",
            font_face: () => "Arial:400",
        },
        ...overrides,
    };
    if (collaborationDocument) {
        // Satisfy the real construction-time readiness checks. These are local
        // fixture values; the provider setup below never opens a connection.
        Object.assign(properties, {
            collabProvider: "custom",
            collab_doc_id: "image-lifecycle",
            collab_url: "wss://example.test",
            collab_jwt: "local-test-token",
        });
        // Use the production adapter/runtime with actual Yjs + Collaboration,
        // replacing only the network-provider setup (no external service).
        instance.data._pendingCollabDocument = collaborationDocument;
        instance.data.maybeSetupCollaboration = (_instance, _properties, _options, extensions) => {
            extensions.push(window.tiptap.Collaboration.configure({ document: instance.data._collabDocument }));
        };
    }
    instance.data.setupEditor(properties, context);
    await settle();
    assert.ok(instance.data.editor_is_ready, debuggerMessages.join("\n"));
    return { instance, states, events, debuggerMessages, uploads, properties, context, rootElement,
        deleted: () => events.filter((event) => event.name === "image_deleted"),
        close() { instance.data.teardownEditor("test"); rootElement.remove(); },
    };
}

function images(harness, src) {
    const result = [];
    harness.instance.data.editor.state.doc.descendants((node, pos) => {
        if (node.type.name === "image" && (!src || node.attrs.src === src)) result.push({ node, pos });
    });
    return result;
}

function removeImage(harness, src) {
    const editor = harness.instance.data.editor;
    const image = images(harness, src)[0];
    assert.ok(image, `image must exist: ${src}`);
    editor.commands.setNodeSelection(image.pos);
    assert.equal(editor.commands.keyboardShortcut("Backspace"), true);
}

// Loaded images are tracked without appearing in the upload operation list.
const loaded = await makeHarness(html(A, B));
assert.deepEqual(loaded.states.get("fileUploadUrls"), []);
assert.deepEqual(loaded.states.get("removed_image_urls"), []);
removeImage(loaded, A);
assert.deepEqual(loaded.deleted(), [{ name: "image_deleted", removed: [A], uploads: [] }]);
assert.deepEqual(loaded.states.get("removed_image_urls"), [A]);
loaded.instance.data.editor.commands.setTextSelection(1);
assert.deepEqual(loaded.states.get("removed_image_urls"), [A], "selection does not clear event data");
loaded.instance.data.editor.commands.undo();
assert.equal(images(loaded, A).length, 1);
assert.deepEqual(loaded.states.get("removed_image_urls"), []);
assert.equal(loaded.deleted().length, 1, "undo restoration is silent");
loaded.instance.data.editor.commands.redo();
assert.deepEqual(loaded.deleted().at(-1).removed, [A]);
assert.equal(loaded.deleted().length, 2, "redo deletion reports removal again");
loaded.close();

// Duplicate URLs and multi-image range deletion produce distinct last-reference URLs.
const duplicates = await makeHarness(html(A, A, B, C));
removeImage(duplicates, A);
assert.equal(duplicates.deleted().length, 0);
assert.deepEqual(duplicates.states.get("removed_image_urls"), []);
const remaining = images(duplicates);
const last = remaining.at(-1);
duplicates.instance.data.editor.commands.setTextSelection({ from: remaining[0].pos - 1, to: last.pos + last.node.nodeSize + 1 });
assert.equal(duplicates.instance.data.editor.commands.keyboardShortcut("Backspace"), true);
assert.deepEqual(duplicates.deleted().map((event) => event.removed), [[A, B, C]]);
assert.equal(images(duplicates).length, 0);
duplicates.close();

// Selecting the entire document and deleting is an edit, not a document switch.
const all = await makeHarness(html(A, B));
all.instance.data.editor.commands.selectAll();
assert.equal(all.instance.data.editor.commands.keyboardShortcut("Delete"), true);
assert.deepEqual(all.deleted().map((event) => event.removed), [[A, B]]);
all.close();

// Moving an image within one transaction does not lose the URL reference.
const moved = await makeHarness(html(A, B));
const movedEditor = moved.instance.data.editor;
const original = images(moved, A)[0];
const moveTransaction = movedEditor.state.tr.delete(original.pos, original.pos + original.node.nodeSize);
moveTransaction.insert(moveTransaction.doc.content.size, original.node);
movedEditor.view.dispatch(moveTransaction);
assert.equal(images(moved, A).length, 1);
assert.equal(moved.deleted().length, 0);
moved.close();

// Insert action appends URL; it does not upload or fake the upload event.
const inserted = await makeHarness();
insertImage(inserted.instance, { insert_image: A, alt_text: "Alt", title: "Title" }, inserted.context);
assert.deepEqual(inserted.states.get("fileUploadUrls"), [A]);
assert.equal(images(inserted, A)[0].node.attrs.alt, "Alt");
assert.equal(images(inserted, A)[0].node.attrs.title, "Title");
assert.deepEqual(inserted.uploads, []);
assert.equal(inserted.events.filter((event) => event.name === "fileUploaded").length, 0);
inserted.instance.data.editor.commands.undo();
assert.deepEqual(inserted.deleted().at(-1).removed, [A], "undo insertion is a removal");
assert.deepEqual(inserted.states.get("fileUploadUrls"), [A], "operation list is not current document inventory");
inserted.instance.data.editor.commands.redo();
assert.equal(images(inserted, A).length, 1);
assert.deepEqual(inserted.states.get("removed_image_urls"), []);
assert.equal(inserted.deleted().length, 1);
inserted.instance.data.editor.commands.setTextSelection(1);
insertImage(inserted.instance, { insert_image: A }, inserted.context);
assert.deepEqual(inserted.states.get("fileUploadUrls"), [A, A]);
removeImage(inserted, A);
assert.equal(inserted.deleted().length, 1);
removeImage(inserted, A);
assert.deepEqual(inserted.deleted().at(-1).removed, [A]);
const beforeBlank = [...inserted.states.get("fileUploadUrls")];
insertImage(inserted.instance, { insert_image: "" }, inserted.context);
assert.deepEqual(inserted.states.get("fileUploadUrls"), beforeBlank);
inserted.close();

// A filtered transaction can return true from setImage without inserting anything.
const blocked = await makeHarness();
const Plugin = blocked.instance.data.editor.state.plugins[0].constructor;
const rejectImageChanges = new Plugin({ filterTransaction: (transaction) => !transaction.docChanged });
blocked.instance.data.editor.registerPlugin(rejectImageChanges);
insertImage(blocked.instance, { insert_image: A }, blocked.context);
assert.equal(images(blocked).length, 0);
assert.deepEqual(blocked.states.get("fileUploadUrls"), []);
assert.equal(blocked.events.filter((event) => event.name === "fileUploaded").length, 0);
blocked.close();

const disabled = await makeHarness("<p>No images enabled</p>", { ext_image: false });
insertImage(disabled.instance, { insert_image: A }, disabled.context);
assert.deepEqual(disabled.states.get("fileUploadUrls"), []);
assert.equal(disabled.uploads.length, 0);
disabled.close();

// Replacing an image src reports the old URL only if its final reference is gone.
const attributes = await makeHarness(html(A));
attributes.instance.data.editor.commands.setNodeSelection(images(attributes)[0].pos);
attributes.instance.data.editor.commands.updateAttributes("image", { title: "Changed" });
assert.equal(attributes.deleted().length, 0);
attributes.instance.data.editor.commands.updateAttributes("image", { src: B });
assert.deepEqual(attributes.deleted().at(-1).removed, [A]);
assert.equal(images(attributes, B).length, 1);
attributes.close();

// Set content, Clear contents and both silent/emitting replacements are not deletion edits.
const switches = await makeHarness(html(A));
for (const emitUpdate of [false, true]) {
    switches.instance.data.editor.commands.setContent(html(B), { emitUpdate });
    assert.equal(switches.deleted().length, 0);
    switches.instance.data.editor.commands.setContent(html(A), { emitUpdate });
}
setContent(switches.instance, { content: html(B), is_json: false, parseOptions_preserveWhitespace: "full" }, switches.context);
assert.equal(switches.deleted().length, 0);
removeImage(switches, B);
assert.deepEqual(switches.deleted().at(-1).removed, [B], "replacement becomes the next edit's baseline");
setContent(switches.instance, { content: html(A), is_json: false }, switches.context);
assert.deepEqual(switches.states.get("removed_image_urls"), []);
clearContents(switches.instance, {}, switches.context);
assert.equal(switches.deleted().length, 1);
assert.equal(images(switches).length, 0);
update(switches.instance, { ...switches.properties, initialContent: html(C) }, switches.context);
assert.equal(switches.deleted().length, 1);
removeImage(switches, C);
assert.deepEqual(switches.deleted().at(-1).removed, [C]);
reset(switches.instance, switches.context);
assert.deepEqual(switches.states.get("removed_image_urls"), []);
assert.equal(switches.deleted().length, 2);
switches.instance.data.setupEditor({ ...switches.properties, initialContent: html(B) }, switches.context);
await settle();
assert.equal(switches.deleted().length, 2);
removeImage(switches, B);
assert.deepEqual(switches.deleted().at(-1).removed, [B]);
switches.close();

// Extension rebuild carries existing images without pretending to delete them.
const rebuild = await makeHarness(html(A));
update(rebuild.instance, { ...rebuild.properties, ext_find_replace: !rebuild.properties.ext_find_replace }, rebuild.context);
await settle();
assert.equal(rebuild.deleted().length, 0);
assert.equal(images(rebuild, A).length, 1);
removeImage(rebuild, A);
assert.deepEqual(rebuild.deleted().at(-1).removed, [A]);
rebuild.close();

// Autobinding document switches, including an empty destination, stay silent.
const bound = await makeHarness("", {
    autobinding: html(A), autobinding_record_id: "record-a",
    bubble: { auto_binding: () => true, fit_height: () => false,
        font_size: () => 16, font_color: () => "#111111", font_face: () => "Arial:400" },
});
update(bound.instance, { ...bound.properties, autobinding: html(B), autobinding_record_id: "record-b" }, bound.context);
assert.equal(bound.deleted().length, 0);
removeImage(bound, B);
assert.deepEqual(bound.deleted().at(-1).removed, [B]);
update(bound.instance, { ...bound.properties, autobinding: "", autobinding_record_id: "record-c" }, bound.context);
assert.equal(bound.deleted().length, 1);
assert.deepEqual(bound.states.get("removed_image_urls"), []);
bound.close();

// Real FileHandler callbacks retain batch semantics and actual-upload events.
const upload = await makeHarness();
insertImage(upload.instance, { insert_image: A }, upload.context);
const handler = upload.instance.data.editor.extensionManager.extensions.find((extension) => extension.name === "fileHandler").options;
await handler.onDrop(upload.instance.data.editor, [new window.File(["image"], "upload.png", { type: "image/png" }),
    new window.File(["text"], "notes.txt", { type: "text/plain" })], 1);
const uploadUrls = ["https://example.test/upload.png", "https://example.test/notes.txt"];
assert.deepEqual(upload.states.get("fileUploadUrls"), uploadUrls);
assert.equal(upload.uploads.length, 2);
assert.equal(images(upload, uploadUrls[0]).length, 1);
assert.deepEqual(upload.events.filter((event) => event.name === "fileUploaded").map((event) => event.uploads),
    [[uploadUrls[0]], uploadUrls], "publish before actual upload event");
insertImage(upload.instance, { insert_image: B }, upload.context);
assert.deepEqual(upload.states.get("fileUploadUrls"), [...uploadUrls, B]);
await handler.onPaste(upload.instance.data.editor, [new window.File(["image"], "paste.png", { type: "image/png" })], null);
assert.deepEqual(upload.states.get("fileUploadUrls"), ["https://example.test/paste.png"]);
removeImage(upload, "https://example.test/paste.png");
assert.deepEqual(upload.deleted().at(-1).removed, ["https://example.test/paste.png"]);
assert.equal(upload.events.filter((event) => event.name === "fileUploaded").length, 3);
upload.close();

// JSON-loaded and inline images use the same image-node tracking.
const jsonLoaded = await makeHarness(JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [
    { type: "text", text: "Before" }, { type: "image", attrs: { src: A } }, { type: "text", text: "After" },
] }] }), { content_is_json: true, image_inline: true });
removeImage(jsonLoaded, A);
assert.deepEqual(jsonLoaded.deleted().at(-1).removed, [A]);
jsonLoaded.close();

// Real Yjs remote updates do not emit removal events on the receiving editor.
assert.equal(typeof window.tiptap.isChangeOrigin, "function");
const yLeft = new window.tiptap.Y.Doc();
const yRight = new window.tiptap.Y.Doc();
const left = await makeHarness("", { collab_active: true }, yLeft);
left.instance.data.editor.commands.setContent(html(A, B));
window.tiptap.Y.applyUpdate(yRight, window.tiptap.Y.encodeStateAsUpdate(yLeft));
const right = await makeHarness("", { collab_active: true }, yRight);
await settle();
assert.equal(images(right).length, 2);
removeImage(left, A);
assert.deepEqual(left.deleted().at(-1).removed, [A], "local collaboration deletion notifies");
window.tiptap.Y.applyUpdate(yRight, window.tiptap.Y.encodeStateAsUpdate(yLeft));
assert.equal(images(right, A).length, 0);
assert.equal(right.deleted().length, 0, "remote deletion must not look like local file ownership");
assert.deepEqual(right.states.get("removed_image_urls"), []);
left.instance.data.editor.commands.undo();
left.instance.data.editor.commands.redo();
assert.equal(left.deleted().length, 1, "Yjs-origin collaborative history is deliberately silent");
removeImage(right, B);
assert.deepEqual(right.deleted().at(-1).removed, [B], "remote update becomes the next local edit's baseline");
left.close(); right.close(); yLeft.destroy(); yRight.destroy();

console.log(JSON.stringify({ imageRemovalNotifications: true, insertImageUrlResults: true,
    eventSnapshots: true, duplicatesAndHistory: true, documentSwitchesSilent: true,
    actualUploadBatchCompatibility: true, remoteCollaborationSilent: true }));
