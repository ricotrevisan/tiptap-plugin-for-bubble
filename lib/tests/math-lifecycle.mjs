import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Window } from "happy-dom";

// WTF-234: Mathematics (LaTeX). Off by default with no schema or asset change;
// on, formulas render with KaTeX loaded from a pinned CDN, round-trip through
// HTML/JSON, follow the selection in two states, fire Math clicked on click
// in an editable editor, and are edited by four actions.
// Contract: docs/wtf-234/math-contract.md (case numbers below).

const libRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = resolve(libRoot, "..");
// Script loading is disabled: a KaTeX <script> fails like a blocked CDN unless
// a test lets it "load" (see allowKatexLoad).
const window = new Window({ url: "https://example.test", settings: { disableCSSFileLoading: true, disableJavaScriptFileLoading: true } });
Object.assign(globalThis, {
    window, document: window.document, Node: window.Node, Element: window.Element, HTMLElement: window.HTMLElement,
    ShadowRoot: window.ShadowRoot, MutationObserver: window.MutationObserver, ClipboardEvent: window.ClipboardEvent,
    DOMParser: window.DOMParser, KeyboardEvent: window.KeyboardEvent, getComputedStyle: window.getComputedStyle.bind(window),
    requestAnimationFrame: callback => setTimeout(() => callback(Date.now()), 0),
    cancelAnimationFrame: clearTimeout,
});
// KaTeX warns outside standards mode; happy-dom doesn't report one.
Object.defineProperty(window.document, "compatMode", { value: "CSS1Compat" });
Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true });
const distSource = readFileSync(resolve(libRoot, "dist.js"), "utf8");
await import(pathToFileURL(resolve(libRoot, "dist.js")));
const { default: katex } = await import("katex");

const elementRoot = resolve(root, "src/elements/tiptap-AAC");
const source = name => readFileSync(resolve(elementRoot, `${name}.js`), "utf8");
const initialize = new Function("instance", "context", source("initialize"));
const update = new Function("instance", "properties", "context", source("update"));
const setContent = new Function("instance", "properties", "context", source("actions/set-content-ACW"));
const action = file => existsSync(resolve(elementRoot, `actions/${file}.js`))
    ? new Function("instance", "properties", "context", source(`actions/${file}`))
    : () => assert.fail(`missing action ${file}`);
const insertInlineMath = action("insert-inline-math-insert_inline_math");
const insertBlockMath = action("insert-block-math-insert_block_math");
const updateMath = action("update-math-update_math");
const deleteMath = action("delete-math-delete_math");
const metadata = JSON.parse(readFileSync(resolve(elementRoot, "AAC.json"), "utf8"));
const defaults = Object.fromEntries(Object.values(metadata.fields).map(field => [field.name, field.default_val]));

const settle = () => window.happyDOM.whenAsyncComplete();
const MATH_STATES = ["selected_math_latex", "selected_math_type"];
const katexAssets = () => [...document.querySelectorAll("script, link")]
    .filter(element => /katex/i.test(element.src || element.href || ""));

// 1 (metadata): the field, states, event and actions exist, and the toggle is off.
const field = Object.values(metadata.fields).find(item => item.name === "ext_math");
assert.ok(field, "Mathematics field exists");
assert.equal(field.default_val, false, "Mathematics is off by default");
assert.deepEqual(MATH_STATES.map(name => Object.values(metadata.states).some(state => state.name === name)), [true, true]);
assert.ok(Object.values(metadata.events).some(event => event.name === "math_clicked"), "Math clicked event exists");
for (const id of ["insert_inline_math", "insert_block_math", "update_math", "delete_math"]) {
    assert.ok(metadata.actions[id], `action ${id} is declared`);
}

// 2: KaTeX itself is not bundled; the CDN version is the one the tests use.
assert.ok(!distSource.includes("KaTeX parse error"), "dist.js does not contain KaTeX");
const { version: katexVersion } = JSON.parse(readFileSync(resolve(libRoot, "node_modules/katex/package.json"), "utf8"));
assert.ok(readFileSync(resolve(libRoot, "katex-runtime.js"), "utf8").includes(`katex@${katexVersion}/dist/`),
    `the CDN URL pins the tested KaTeX ${katexVersion}`);

async function makeEditor(overrides = {}, { autoBinding = false, detached = false } = {}) {
    const canvas = document.createElement("div");
    if (!detached) document.body.appendChild(canvas);
    const states = new Map(), events = [], messages = [], autobindings = [];
    const instance = {
        data: {},
        canvas: { 0: canvas, css() {}, append: node => canvas.appendChild(node), parent: () => ({ length: 0 }), height() {} },
        publishState: (key, value) => states.set(key, value),
        // Snapshot math states when each event fires: workflows read them then.
        triggerEvent: name => events.push({ name, states: Object.fromEntries(MATH_STATES.map(key => [key, states.get(key)])) }),
        publishAutobinding: value => autobindings.push(value), canUploadFile: () => true, uploadFile() {},
    };
    const context = { reportDebugger: message => messages.push(String(message)) };
    initialize(instance, context);
    const properties = {
        ...defaults, initialContent: "<p>Hello</p>", content_is_json: false, isEditable: true,
        collab_active: false, ext_history: true, ext_math: true, update_delay: 0, ...overrides,
        bubble: { auto_binding: () => autoBinding, fit_height: () => false, font_size: () => 16,
            font_color: () => "#111111", font_face: () => "Arial:400" },
    };
    const run = (fn, values = {}) => fn(instance, values, context);
    const h = {
        instance, properties, states, events, messages, autobindings,
        get editor() { return instance.data.editor; },
        clicked: () => events.filter(event => event.name === "math_clicked"),
        mathStates: () => MATH_STATES.map(key => states.get(key)),
        async change(values = {}) {
            Object.assign(properties, values);
            update(instance, properties, context);
            await settle();
        },
        // Keyboard input, one character at a time, through the input rules.
        type(text) {
            for (const char of text) {
                const { view } = h.editor;
                const { from, to } = view.state.selection;
                const deflt = () => view.state.tr.insertText(char, from, to);
                if (!view.someProp("handleTextInput", handler => handler(view, from, to, char, deflt))) view.dispatch(deflt());
            }
        },
        math() {
            const found = [];
            h.editor.state.doc.descendants((node, pos) => {
                if (node.type.name === "inlineMath" || node.type.name === "blockMath") found.push({ type: node.type.name, latex: node.attrs.latex, pos });
            });
            return found;
        },
        formulaElement(index = 0) { return h.editor.view.dom.querySelectorAll(".tiptap-mathematics-render")[index]; },
        click(index = 0) {
            h.formulaElement(index).dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
        },
        insertInline: latex => run(insertInlineMath, { latex }),
        insertBlock: latex => run(insertBlockMath, { latex }),
        updateMath: latex => run(updateMath, { latex }),
        deleteMath: () => run(deleteMath, {}),
        setContent: (content, json = false) => run(setContent, { content, is_json: json }),
        close() { instance.data.teardownEditor("test complete"); canvas.remove(); },
    };
    await h.change();
    assert.equal(states.get("is_ready"), true, "editor is ready");
    return h;
}

const MATH_HTML = '<p>Area <span data-type="inline-math" data-latex="\\pi r^2"></span> here</p>'
    + '<div data-type="block-math" data-latex="\\sum_{i=1}^n i"></div>';

// 1: toggle off — no math nodes, no KaTeX assets, output unchanged.
{
    const off = await makeEditor({ ext_math: false, initialContent: MATH_HTML });
    assert.ok(!off.editor.schema.nodes.inlineMath && !off.editor.schema.nodes.blockMath, "no math nodes in the schema");
    assert.deepEqual(katexAssets(), [], "no KaTeX stylesheet or script requested");
    // (Preserve unknown HTML tags keeps the block <div> as a plain div, as before.)
    assert.doesNotMatch(off.editor.getHTML(), /inline-math/, "math HTML is not turned into formulas");
    assert.equal(off.editor.view.dom.querySelector(".tiptap-mathematics-render, .katex"), null, "nothing is rendered as math");
    assert.deepEqual(off.mathStates(), ["", ""], "math states start empty");
    off.type("costs $$5$$");
    assert.match(off.editor.getHTML(), /costs \$\$5\$\$/, "no input rules without the toggle");
    off.close();
}

// Every KaTeX asset the page asks for. While loading is "blocked", both files
// fail; allowKatexLoad makes them load (the script then defines window.katex).
const requested = [];
let katexLoads = false;
const append = document.head.appendChild.bind(document.head);
document.head.appendChild = node => {
    if (/katex/.test(node.src || node.href || "")) {
        requested.push({ tag: node.tagName, url: node.src || node.href, integrity: node.integrity, crossOrigin: node.crossOrigin });
        if (katexLoads && node.tagName === "SCRIPT") window.katex = katex; // the script ran
    }
    return append(node);
};
function allowKatexLoad() {
    window.happyDOM.settings.handleDisabledFileLoadingAsSuccess = true;
    katexLoads = true;
}
const PINNED = "https://cdn.jsdelivr.net/npm/katex@0.16.29/dist/";

// 3: KaTeX blocked — formulas show raw LaTeX, one debugger message, no throw.
const blocked = await makeEditor({ initialContent: MATH_HTML });
await settle();
assert.deepEqual(requested.map(({ tag, url }) => [tag, url]), [["LINK", PINNED + "katex.min.css"], ["SCRIPT", PINNED + "katex.min.js"]],
    "the pinned stylesheet and script are requested");
for (const asset of requested) {
    assert.match(asset.integrity, /^sha384-/, `${asset.tag} has SRI`);
    assert.equal(asset.crossOrigin, "anonymous");
}
assert.deepEqual(katexAssets(), [], "failed assets are removed so a later editor retries");
assert.equal(blocked.formulaElement(0).textContent, "\\pi r^2", "raw LaTeX shows while KaTeX is missing");
assert.equal(blocked.messages.filter(message => /KaTeX/.test(message)).length, 1, "one debugger message");
assert.equal(blocked.math().length, 2);

// 3: an editor built while detached (a canvas Bubble attaches later) and
// replaced content, both before KaTeX arrives.
const detached = await makeEditor({ initialContent: MATH_HTML }, { detached: true });
await new Promise(resolve => setTimeout(resolve, 10));
document.body.appendChild(detached.instance.canvas[0]);
blocked.setContent('<p>Now <span data-type="inline-math" data-latex="e^x"></span></p>');

// 2, 3: KaTeX arrives — waiting formulas are typeset, assets are added once.
allowKatexLoad();
const a = await makeEditor({ initialContent: MATH_HTML });
await settle();
assert.equal(window.katex, katex, "KaTeX loaded");
assert.ok(blocked.formulaElement(0).querySelector(".katex"), "formulas waiting since the blocked load are typeset");
assert.equal(blocked.formulaElement(0).querySelector(".katex-mathml annotation")?.textContent, "e^x", "replaced content is typeset with its own LaTeX");
assert.ok(detached.formulaElement(0).querySelector(".katex"), "an editor built while detached is typeset");
assert.ok(detached.formulaElement(1).querySelector(".katex-display"), "its block formula is typeset in display mode");
detached.close();
assert.ok(a.formulaElement(0).querySelector(".katex"), "inline formula typeset after load");
assert.ok(a.formulaElement(1).querySelector(".katex-display"), "block formula typeset in display mode");
assert.equal(katexAssets().filter(item => item.tagName === "LINK").length, 1, "one stylesheet per page");
assert.equal(katexAssets().filter(item => item.tagName === "SCRIPT").length, 1, "one script per page");
blocked.close();
const b = await makeEditor({ initialContent: "<p>Second editor</p>" });
assert.equal(katexAssets().length, 2, "a second editor adds no assets");

// 5: round trip through HTML and JSON (Preserve unknown HTML tags is on).
assert.equal(defaults.preserve_unknown_tags, true);
const html = a.editor.getHTML();
assert.match(html, /<span data-latex="\\pi r\^2" data-type="inline-math">\\pi r\^2<\/span>/, "inline math HTML with raw LaTeX text");
assert.match(html, /<div data-latex="\\sum_\{i=1\}\^n i" data-type="block-math">\\sum_\{i=1\}\^n i<\/div>/, "block math HTML with raw LaTeX text");
assert.equal(a.states.get("contentHTML"), html);
b.setContent(html);
assert.deepEqual(b.math().map(({ type, latex }) => [type, latex]), a.math().map(({ type, latex }) => [type, latex]), "formulas load from HTML");
const json = b.editor.getJSON(), savedHTML = b.editor.getHTML();
b.setContent(savedHTML);
assert.deepEqual(b.editor.getJSON(), json, "HTML round trip");
b.setContent(JSON.stringify(json), true);
assert.deepEqual(b.editor.getJSON(), json, "JSON round trip");
assert.equal(b.editor.getHTML(), savedHTML);

// 5: a formula without data-latex keeps its text as the LaTeX.
b.setContent('<p><span data-type="inline-math">a+b</span></p>');
assert.deepEqual(b.math().map(({ latex }) => latex), ["a+b"], "text content is the fallback LaTeX");

// 7: loaded text containing $ is never converted.
const dollars = "<p>Price $5, $x$ and $$y$$ stay text.</p>";
b.setContent(dollars);
assert.equal(b.editor.getHTML(), dollars, "Set content keeps $ text");
const loadedDollars = await makeEditor({ initialContent: dollars });
assert.equal(loadedDollars.editor.getHTML(), dollars, "initial content keeps $ text");
loadedDollars.close();

// 8, 9: typing.
b.setContent("<p></p>");
b.editor.commands.focus("end");
b.type("It costs $5 or $10.");
assert.equal(b.editor.getHTML(), "<p>It costs $5 or $10.</p>", "currency stays text");
b.type(" $$x^2$$");
assert.deepEqual(b.math().map(({ type, latex }) => [type, latex]), [["inlineMath", "x^2"]], "$$…$$ makes inline math");
b.editor.commands.enter();
b.type("$$$\\sum x$$$");
assert.deepEqual(b.math().map(({ type, latex }) => [type, latex]), [["inlineMath", "x^2"], ["blockMath", "\\sum x"]], "$$$…$$$ makes block math");

// 10, 11, 13: clicking selects, publishes, then fires once — only in its editor.
a.click(0);
assert.equal(a.clicked().length, 1, "Math clicked fires once");
assert.deepEqual(a.clicked()[0].states, { selected_math_latex: "\\pi r^2", selected_math_type: "inline" }, "states are set before the event");
assert.equal(a.editor.state.selection.node?.type.name, "inlineMath", "the formula is selected");
assert.equal(b.clicked().length, 0, "another editor does not fire");
a.click(1);
assert.deepEqual(a.clicked()[1].states, { selected_math_latex: "\\sum_{i=1}^n i", selected_math_type: "block" });

// 10: states follow the selection (text cursor, keyboard).
a.editor.commands.setTextSelection(2);
assert.deepEqual(a.mathStates(), ["", ""], "a text cursor clears the states");
const inlinePos = a.math()[0].pos;
// A selection made without clicking (real arrow keys: math.spec.mjs).
a.editor.commands.setNodeSelection(inlinePos);
assert.deepEqual(a.mathStates(), ["\\pi r^2", "inline"], "selecting without a click fills the states");
assert.equal(a.clicked().length, 2, "selecting without a click does not fire Math clicked");

// 15: Update math, inline then block; states show the new LaTeX.
a.updateMath("\\pi d");
assert.equal(a.math()[0].latex, "\\pi d");
assert.deepEqual(a.mathStates(), ["\\pi d", "inline"], "the updated formula stays selected");
a.click(1);
a.updateMath("\\int_0^1 x\\,dx");
assert.equal(a.math()[1].latex, "\\int_0^1 x\\,dx");
assert.deepEqual(a.mathStates(), ["\\int_0^1 x\\,dx", "block"]);
assert.ok(a.formulaElement(1).querySelector(".katex-display"), "updated block is re-rendered");
a.updateMath("");
assert.equal(a.math()[1].latex, "\\int_0^1 x\\,dx", "empty LaTeX changes nothing");

// 10: undo follows the selection too.
a.editor.commands.undo();
assert.equal(a.math()[1].latex, "\\sum_{i=1}^n i", "undo restores the formula");
assert.equal(a.states.get("selected_math_latex"), a.editor.state.selection.node?.attrs.latex ?? "", "states match the selection after undo");

// 15, 16: nothing selected — Update and Delete do nothing.
a.editor.commands.setTextSelection(2);
const beforeNoop = JSON.stringify(a.editor.getJSON());
a.updateMath("y");
a.deleteMath();
assert.equal(JSON.stringify(a.editor.getJSON()), beforeNoop, "Update/Delete math need a selected formula");

// 16: Delete math on the selection.
a.click(0);
a.deleteMath();
assert.deepEqual(a.math().map(({ type }) => type), ["blockMath"], "inline formula deleted");
assert.deepEqual(a.mathStates(), ["", ""], "states cleared after delete");
a.click(0);
a.deleteMath();
assert.equal(a.math().length, 0, "block formula deleted");

// 14: Insert inline / block math at the cursor.
a.setContent("<p>ab</p>");
a.editor.commands.setTextSelection(2);
a.insertInline("e^{i\\pi}");
assert.equal(a.editor.getHTML(), '<p>a<span data-latex="e^{i\\pi}" data-type="inline-math">e^{i\\pi}</span>b</p>');
a.insertBlock("\\frac{1}{2}");
assert.deepEqual(a.math().map(({ type }) => type), ["inlineMath", "blockMath"]);
const beforeEmpty = JSON.stringify(a.editor.getJSON());
a.insertInline("");
a.insertBlock("");
assert.equal(JSON.stringify(a.editor.getJSON()), beforeEmpty, "empty LaTeX inserts nothing");

// 6: invalid LaTeX renders red, never throws, and is still saved.
a.editor.commands.setTextSelection(1);
a.insertInline("\\frac{");
const invalid = a.editor.view.dom.querySelector(".katex-error");
assert.ok(invalid, "invalid LaTeX is shown as a KaTeX error");
assert.equal(invalid.textContent, "\\frac{", "raw source is shown");
assert.match(invalid.getAttribute("style") || "", /color:\s*#cc0000/, "in red");
assert.match(a.states.get("contentHTML"), /data-latex="\\frac\{"/, "content with invalid LaTeX is published");

// 6: autobinding saves content containing (invalid) math.
const bound = await makeEditor({ autobinding: "<p>x</p>" }, { autoBinding: true });
bound.editor.commands.focus("end");
bound.insertInline("\\bad{");
await new Promise(resolve => setTimeout(resolve, 20));
bound.editor.commands.blur();
await settle();
assert.ok(bound.autobindings.some(value => /data-latex="\\bad\{"/.test(value)), "autobinding saves invalid LaTeX");
bound.close();

// 12: read-only — a click does nothing.
const readOnly = await makeEditor({ initialContent: MATH_HTML, isEditable: false });
const readOnlySelection = readOnly.editor.state.selection.toJSON();
readOnly.click(0);
assert.equal(readOnly.clicked().length, 0, "no event in read-only mode");
assert.deepEqual(readOnly.editor.state.selection.toJSON(), readOnlySelection, "no selection change in read-only mode");
assert.deepEqual(readOnly.mathStates(), ["", ""]);
// Becoming editable later enables clicks without rebuilding.
await readOnly.change({ isEditable: true });
readOnly.click(0);
assert.equal(readOnly.clicked().length, 1, "click fires once the editor is editable");
readOnly.close();

// 4: toggling Mathematics on a live editor rebuilds and keeps content.
const toggled = await makeEditor({ ext_math: false, initialContent: "<p>Keep me</p>" });
toggled.editor.commands.insertContentAt(1, "Draft ");
await toggled.change({ ext_math: true });
assert.ok(toggled.editor.schema.nodes.inlineMath, "turning Mathematics on rebuilds with math nodes");
assert.equal(toggled.editor.getText(), "Draft Keep me", "unsaved content is kept");
toggled.editor.commands.focus("end");
toggled.insertInline("a^2");
await toggled.change({ ext_math: false });
assert.ok(!toggled.editor.schema.nodes.inlineMath, "turning Mathematics off rebuilds without math nodes");
assert.equal(toggled.editor.getText(), "Draft Keep mea^2", "unsaved content is kept, formulas as their LaTeX");
toggled.close();

// 17: with Mathematics off the actions report and do nothing.
const offActions = await makeEditor({ ext_math: false });
const offBefore = offActions.editor.getHTML();
offActions.insertInline("x");
offActions.insertBlock("x");
offActions.updateMath("x");
offActions.deleteMath();
assert.equal(offActions.editor.getHTML(), offBefore);
assert.equal(offActions.messages.filter(message => /Mathematics/.test(message)).length, 4, "each action reports the extension is off");
offActions.close();

a.close();
b.close();
console.log("math-lifecycle: all checks passed");
