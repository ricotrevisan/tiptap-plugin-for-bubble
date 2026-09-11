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
assert.equal(metadata.fields.autobinding_record_id?.editor, "DynamicValue");
assert.match(readFileSync(resolve(root, "src/elements/tiptap-AAC/fields.txt"), "utf8"), /\(autobinding_record_id\)/);
const defaults = Object.fromEntries(Object.values(metadata.fields).map((field) => [field.name, field.default_val]));
const update = new Function(
    "instance",
    "properties",
    "context",
    readFileSync(resolve(root, "src/elements/tiptap-AAC/update.js"), "utf8"),
);
async function makeHarness({ content = "<p>seed</p>", autoBinding = true, delay = 0, saveDelay = delay, recordId = "" } = {}) {
    const rootElement = document.createElement("div");
    document.body.appendChild(rootElement);
    const states = new Map();
    const debuggerMessages = [];
    const writes = [];
    const events = [];
    let now = 0, sequence = 0;
    const timers = new Map();
    const schedule = (callback, delay) => { const id = ++sequence; timers.set(id, {callback, at: now + delay}); return id; };
    const cancel = id => timers.delete(id);
    const advance = ms => { now += ms; for (const [id,timer] of [...timers]) { if (timer.at <= now && timers.delete(id)) timer.callback(); } };
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
        triggerEvent(name) { events.push(name); },
        publishAutobinding(content) { writes.push(content); },
        canUploadFile() {
            return true;
        },
        uploadFile() {},
    };
    const context = {
        reportDebugger(message) {
            debuggerMessages.push(String(message));
        },
        reportToDebugger(message) {
            debuggerMessages.push(String(message));
        },
    };
    new Function("instance", "context", "setTimeout", "clearTimeout", readFileSync(resolve(root, "src/elements/tiptap-AAC/initialize.js"), "utf8"))(instance, context, schedule, cancel);

    const properties = new Proxy(
        {
            ...defaults,
            ext_table_of_contents: false,
            update_delay: delay,
            autobinding_save_delay: saveDelay,
            autobinding_record_id: recordId,
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

    update(instance, properties, context);
    await window.happyDOM.whenAsyncComplete();
    const h = { instance, states, debuggerMessages, properties, context, writes, events, advance };
    h.editor = instance.data.editor;
    h.receive = (content, recordId = properties.autobinding_record_id) => { properties.autobinding = content; properties.autobinding_record_id = recordId; update(instance, properties, context); };
    h.type = text => h.editor.commands.insertContentAt(h.editor.state.doc.content.size - 1, text);
    h.close = () => { instance.data.teardownEditor("test"); rootElement.remove(); };
    return h;
}



const results = [];
async function scenario(name, options, run) {
    const h = await makeHarness(options);
    try { await run(h); results.push(name); } finally { h.close(); }
}
for (const delay of [0, 300]) {
    await scenario(`delayed echoes at ${delay}ms`, {delay}, h => {
        h.type(" first"); h.advance(delay);
        const old = h.writes.at(-1);
        h.type(" second"); h.advance(delay);
        const latest = h.editor.getHTML();
        const selection = h.editor.state.selection.from;
        h.receive(old);
        assert.equal(h.editor.getHTML(), latest, "delayed self-echo removed newer typing");
        assert.equal(h.editor.state.selection.from, selection);
        assert.equal(h.writes.length, 2);
    });
    await scenario(`switch while saving at ${delay}ms`, {delay}, h => {
        h.type(" pending A");
        h.receive("<p>Record B</p>");
        h.advance(delay);
        assert.equal(h.editor.getHTML(), "<p>Record B</p>");
        assert.deepEqual(h.writes, [], "A was published after switching to B");
    });
}
await scenario("identical records still switch", {delay:300,recordId:"A"}, h => {
    h.type(" pending A");
    h.receive("<p>seed</p>", "B");
    h.advance(300);
    assert.equal(h.editor.getHTML(), "<p>seed</p>");
    assert.deepEqual(h.writes, []);
});
await scenario("external content does not save itself", {}, h => {
    h.receive("<p>External edit</p>"); h.advance(300);
    assert.equal(h.editor.getHTML(), "<p>External edit</p>");
    assert.deepEqual(h.writes, []);
});
await scenario("blur flushes a dirty edit once", {delay:300}, h => {
    h.type(" final edit");
    h.editor.emit("blur", {editor:h.editor,event:{}});
    h.advance(300);
    assert.deepEqual(h.writes, ["<p>seed final edit</p>"]);
    h.editor.emit("blur", {editor:h.editor,event:{}});
    assert.equal(h.writes.length, 1, "clean blur re-published a document");
});
await scenario("blur after switching cannot save A", {delay:300}, h => {
    h.type(" pending A"); h.receive("<p>Record B</p>");
    h.editor.emit("blur", {editor:h.editor,event:{}}); h.advance(300);
    assert.deepEqual(h.writes, []);
});
await scenario("teardown invalidates pending work", {delay:300}, h => {
    h.type(" pending A"); h.instance.data.teardownEditor("test"); h.advance(300);
    assert.deepEqual(h.writes, []);
});
await scenario("detached editor cannot publish", {delay:300}, h => {
    h.type(" pending A"); h.instance.canvas[0].remove(); h.advance(300);
    document.body.appendChild(h.instance.canvas[0]);
    h.instance.data.flushPendingContent();
    assert.deepEqual(h.writes, []);
});
await scenario("explicit save workflow still receives events", {autoBinding:false,delay:300}, h => {
    h.type(" user edit"); h.advance(300);
    assert.deepEqual(h.writes, []);
    assert.equal(h.events.filter(x=>x==="contentUpdated").length, 1);
});
await scenario("a record change wins over a known echo", {recordId:"A"}, h => {
    h.type(" first"); h.advance(0); const savedA = h.writes[0];
    h.type(" later"); h.advance(0);
    h.receive(savedA, "B");
    assert.equal(h.editor.getHTML(), savedA);
});
await scenario("many delayed saves retain echo protection", {}, h => {
    let first;
    for (let i=0;i<260;i++) { h.type("x"); h.advance(0); if(i===0) first=h.writes[0]; }
    const latest=h.editor.getHTML();h.receive(first);
    assert.equal(h.editor.getHTML(),latest);
});
await scenario("undo cannot restore another record", {recordId:"A"}, h => {
    h.type(" saved in A"); h.advance(0);
    h.receive("<p>Record B</p>", "B");
    h.editor.commands.undo();
    assert.equal(h.editor.getHTML(), "<p>Record B</p>");
});
await scenario("record switch during extension rebuild loads the new record", {delay:300,recordId:"A"}, async h => {
    h.type(" pending A");
    h.properties.ext_table_of_contents = true;
    h.receive("<p>Record B</p>", "B");
    await window.happyDOM.whenAsyncComplete();
    h.advance(300);
    assert.equal(h.instance.data.editor.getHTML(), "<p>Record B</p>");
    assert.deepEqual(h.writes, []);
});
await scenario("out-of-order saves converge without another keystroke", {recordId:"A"}, h => {
    h.type(" first"); h.advance(0); const first = h.writes.at(-1);
    h.type(" second"); h.advance(0); const latest = h.writes.at(-1);
    // Bubble exposes an optimistic echo before server completion. The older
    // request then commits last, leaving the real database at the first value.
    h.receive(latest);
    let database = first;
    h.receive(database);
    h.advance(2200);
    assert.equal(h.writes.length, 3, "stale server completion must schedule a corrective write");
    database = h.writes.at(-1);
    h.receive(database); h.advance(2200);
    assert.equal(database, latest);
    assert.equal(h.editor.getHTML(), latest);
    assert.equal(h.events.filter(x => x === "contentUpdated").length, 2, "repair must not repeat workflows");
    assert.equal(h.writes.length, 3, "settled content must stop writing");
});
await scenario("autobinding coalesces separately from update delay", {delay:0,saveDelay:2200}, h => {
    h.type(" first"); h.advance(1000);
    h.type(" final"); h.advance(2199);
    assert.deepEqual(h.writes, []);
    assert.equal(h.states.get("contentHTML"), h.editor.getHTML(), "states must remain immediate");
    h.advance(1);
    assert.deepEqual(h.writes, [h.editor.getHTML()]);
    assert.equal(h.events.filter(x => x === "contentUpdated").length, 1);
});
await scenario("old echoes do not postpone pending typing or duplicate workflows", {saveDelay:300}, h => {
    h.type(" first"); h.advance(300); const old = h.writes.at(-1);
    h.type(" last"); h.advance(200); h.receive(old); h.advance(100);
    assert.equal(h.writes.at(-1), h.editor.getHTML());
    assert.equal(h.writes.length, 2);
});
await scenario("record switch cancels a queued stale-save repair", {recordId:"A"}, h => {
    h.type(" first"); h.advance(0); const old=h.writes.at(-1);
    h.type(" final"); h.advance(0); h.receive(old);
    h.receive("<p>B</p>", "B"); h.advance(2200);
    assert.equal(h.writes.length, 2);
    assert.equal(h.editor.getHTML(), "<p>B</p>");
});
await scenario("external value cancels a queued stale-save repair", {}, h => {
    h.type(" first"); h.advance(0); const old=h.writes.at(-1);
    h.type(" final"); h.advance(0); h.receive(old);
    h.receive("<p>External edit</p>"); h.advance(2200);
    assert.equal(h.writes.length, 2);
    assert.equal(h.editor.getHTML(), "<p>External edit</p>");
});
await scenario("same-record schema rebuild preserves a pending save", {recordId:"A",saveDelay:300}, async h => {
    h.type(" unsaved");
    h.properties.ext_table_of_contents = true;
    h.receive(h.properties.autobinding);
    await window.happyDOM.whenAsyncComplete();
    h.advance(300);
    assert.deepEqual(h.writes, ["<p>seed unsaved</p>"]);
});
for (const order of [[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]]) {
    await scenario(`server completion order ${order.map(x=>x+1).join("-")} converges`, {recordId:"A"}, h => {
        for (const word of [" one"," two"," three"]) {
            h.type(word); h.advance(0);
            h.receive(h.writes.at(-1)); // optimistic client update, not an ACK
        }
        const latest = h.editor.getHTML();
        const requests = [...h.writes];
        let database;
        for (const index of order) { database=requests[index]; h.receive(database); }
        h.advance(250);
        if (h.writes.length > 3) { database=h.writes.at(-1); h.receive(database); }
        h.advance(2200);
        assert.equal(database, latest);
        assert.equal(h.editor.getHTML(), latest);
        assert.ok(h.writes.length <= 4, "late responses should coalesce into at most one correction here");
        assert.equal(h.events.filter(x=>x==="contentUpdated").length, 3);
    });
}
console.log(JSON.stringify({passed: results.length, scenarios:results}));
