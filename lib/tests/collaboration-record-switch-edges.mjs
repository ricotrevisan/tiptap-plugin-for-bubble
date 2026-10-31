import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Window } from "happy-dom";

const libRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = resolve(libRoot, "..");
const window = new Window({ url: "https://example.test" });
Object.assign(globalThis, {
    window, document: window.document, Node: window.Node, HTMLElement: window.HTMLElement,
    ShadowRoot: window.ShadowRoot, MutationObserver: window.MutationObserver, DOMParser: window.DOMParser,
    getComputedStyle: window.getComputedStyle.bind(window),
    requestAnimationFrame: (cb) => setTimeout(() => cb(Date.now()), 0),
    cancelAnimationFrame: (h) => clearTimeout(h),
});
Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true });
await import(pathToFileURL(resolve(libRoot, "dist.js")));

const metadata = JSON.parse(readFileSync(resolve(root, "src/elements/tiptap-AAC/AAC.json"), "utf8"));
const defaults = Object.fromEntries(Object.values(metadata.fields).map((f) => [f.name, f.default_val]));
const initialize = new Function("instance", "context", readFileSync(resolve(root, "src/elements/tiptap-AAC/initialize.js"), "utf8"));
const update = new Function("instance", "properties", "context", readFileSync(resolve(root, "src/elements/tiptap-AAC/update.js"), "utf8"));

async function makeHarness(overrides = {}) {
    const rootElement = document.createElement("div");
    document.body.appendChild(rootElement);
    const states = new Map(); const messages = [];
    const instance = {
        data: {},
        canvas: { css() {}, append(el) { rootElement.appendChild(el); }, parent() { return { length: 0 }; }, height() {} },
        publishState(n, v) { states.set(n, v); }, triggerEvent() {}, publishAutobinding() {},
        canUploadFile() { return true; }, uploadFile() {},
    };
    const context = { reportDebugger(m) { messages.push(String(m)); } };
    initialize(instance, context);
    const properties = new Proxy({
        ...defaults, initialContent: "<p>Hello</p>", content_is_json: false, isEditable: true, collab_active: false, ...overrides,
        bubble: { auto_binding: () => false, fit_height: () => false, font_size: () => 16, font_color: () => "#111111", font_face: () => "Arial:400" },
    }, { get(t, k) { return k in t ? t[k] : undefined; } });
    instance.data.setupEditor(properties, context);
    await new Promise((r) => setTimeout(r, 30));
    return { instance, states, messages, properties, context };
}
const providers = [];
const RealProvider = window.tiptap.HocuspocusProvider;
class Provider extends RealProvider {
    constructor(options) {
        assert.ok(providers.every((p) => p.destroyed), "dispose old provider before replacement");
        super({ ...options, connect: false, WebSocketPolyfill: window.WebSocket });
        this.options = options; this.destroyed = false; providers.push(this);
    }
    destroy() { super.destroy(); this.destroyed = true; }
}
window.tiptap.HocuspocusProvider = Provider;
async function change(h, values) { Object.assign(h.properties, values); update(h.instance, h.properties, h.context); await new Promise((r) => setTimeout(r, 30)); }
async function synced(h) { h.instance.data.provider.options.onSynced(); await new Promise((r) => setTimeout(r, 30)); return h.instance.data.editor.getText(); }

const goalHtml = "<p>GOAL UPDATE: Apollo Tires</p>";
const issueHtml = "<p>ISSUE: Team stretched too thin</p>";
const shared = { collab_active: true, collabProvider: "custom", collab_jwt: "token", collab_url: "wss://example.test", collab_app_id: "app" };
const results = [];
let current = null;
async function scenario(name, fn) {
    current = null;
    try { await fn(); results.push(["PASS", name]); }
    catch (e) { results.push(["FAIL", name + " :: " + e.message]); }
    finally {
        try { current?.instance.data.teardownEditor("scenario end"); } catch {}
        for (const p of providers) { if (!p.destroyed) { try { p.destroy(); } catch {} p.destroyed = true; } }
    }
}

// P. Pending rebuild while credentials load, record changes meanwhile.
await scenario("P pending-gap: local A -> shared A (no jwt) -> doc B (no jwt) -> jwt arrives seeds B not A", async () => {
    const h = current = await makeHarness({ initialContent: goalHtml });
    await change(h, { ...shared, collab_jwt: "", collab_doc_id: "ws.a.goal" });
    assert.equal(h.instance.data.isEditorSetup, false, "editor torn down, waiting for credentials");
    await change(h, { collab_doc_id: "ws.b.issue", initialContent: issueHtml });
    await change(h, { collab_jwt: "token" });
    const text = await synced(h);
    assert.doesNotMatch(text, /GOAL/, "B seeded with A's snapshot: " + text);
    assert.match(text, /ISSUE/);
    h.instance.data.teardownEditor("done");
});

// Q. DEF-2254 path: shared A -> active with empty doc (waits) -> shared B.
await scenario("Q empty-doc interlude: shared A -> active doc '' -> shared B seeds B", async () => {
    const h = current = await makeHarness({ initialContent: goalHtml, ...shared, collab_doc_id: "ws.a.goal" });
    await synced(h);
    await change(h, { collab_doc_id: "", initialContent: "" });
    assert.equal(h.instance.data.isEditorSetup, false, "waits with no editor");
    await change(h, { collab_doc_id: "ws.b.issue", initialContent: issueHtml });
    const text = await synced(h);
    assert.doesNotMatch(text, /GOAL/); assert.match(text, /ISSUE/);
    h.instance.data.teardownEditor("done");
});

// R. Same-content records through a local interlude whose initialContent is "" (update handler skips "").
await scenario("R same-content A/B via local '' interlude: typed text in A never reaches B", async () => {
    const same = "<p>same</p>";
    const h = current = await makeHarness({ initialContent: same, ...shared, collab_doc_id: "ws.a.goal" });
    h.instance.data.provider.options.onSynced();
    h.instance.data.editor.commands.insertContent("typed in A ");
    await change(h, { collab_active: false, initialContent: "" });
    await change(h, { ...shared, collab_doc_id: "ws.b.goal", initialContent: same });
    const text = await synced(h);
    assert.doesNotMatch(text, /typed in A/, "B got A's text: " + text);
    h.instance.data.teardownEditor("done");
});

// S. Extension toggle in the same update as a local -> shared record switch.
await scenario("S ext toggle + local A -> shared B in one update seeds B", async () => {
    const h = current = await makeHarness({ initialContent: goalHtml, ext_math: false });
    await change(h, { ...shared, collab_doc_id: "ws.b.issue", initialContent: issueHtml, ext_math: true });
    const text = await synced(h);
    assert.doesNotMatch(text, /GOAL/); assert.match(text, /ISSUE/);
    h.instance.data.teardownEditor("done");
});

// T. Local edits during a token wait for the SAME record, after a previous shared doc.
await scenario("T local edits in B during token wait after shared A are kept ", async () => {
    const h = current = await makeHarness({ initialContent: goalHtml, ...shared, collab_doc_id: "ws.a.goal" });
    await synced(h);
    await change(h, { collab_active: false, initialContent: issueHtml }); // record B, token missing -> local
    h.instance.data.editor.commands.insertContent("typed in B ");
    await change(h, { ...shared, collab_doc_id: "ws.b.issue" }); // token arrives
    const text = await synced(h);
    assert.match(text, /typed in B/, "local edits dropped: " + text);
    h.instance.data.teardownEditor("done");
});

// U. initialContent unset (undefined) vs "" must not count as a record change.
await scenario("U initialContent undefined vs '' is not a record change (local A edits carried to shared A)", async () => {
    const h = current = await makeHarness({ initialContent: "" });
    h.instance.data.editor.commands.insertContent("unsaved ");
    await change(h, { ...shared, collab_doc_id: "ws.a.goal", initialContent: undefined });
    const text = await synced(h);
    assert.match(text, /unsaved/);
    h.instance.data.teardownEditor("done");
});

for (const [s, n] of results) console.log(s, n);
process.exit(results.some(([s]) => s === "FAIL") ? 1 : 0);
