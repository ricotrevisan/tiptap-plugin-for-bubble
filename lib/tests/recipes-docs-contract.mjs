import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// WTF-263: docs/recipes.md must name things a Bubble developer can find in the
// editor, match the plugin's real defaults, and point at tests that prove it.

const libRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = resolve(libRoot, "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const json = (path) => JSON.parse(read(path));

const canonicalDemo = "https://tiptap-plugin.bubbleapps.io/version-test/tiptap-demo";
const oldDemo = "tiptap-demo.bubbleapps.io/version-test/doc/demo";

const readme = read("README.md");
assert.ok(readme.includes(canonicalDemo), "README links the canonical demo page");
assert.ok(!readme.includes(oldDemo), "README no longer links the old demo app");
assert.ok(readme.includes("(docs/recipes.md)"), "README links the recipes");

// The Marketplace listing points at the same demo page.
const pluginMeta = json("src/plugin.json").meta_data;
assert.equal(pluginMeta.demo_page, canonicalDemo, "plugin demo page is the canonical demo");
assert.ok(pluginMeta.description.includes(canonicalDemo), "plugin description links the canonical demo");
assert.ok(!pluginMeta.description.includes(oldDemo), "plugin description no longer links the old demo app");

assert.ok(existsSync(resolve(root, "docs/recipes.md")), "docs/recipes.md exists");
const recipes = read("docs/recipes.md");
assert.ok(recipes.includes(canonicalDemo), "recipes link the canonical demo page");
assert.ok(!recipes.includes(oldDemo), "recipes don't link the old demo app");

// Every bold term is a name from the plugin or from Bubble's own editor.
const element = json("src/elements/tiptap-AAC/AAC.json");
const serverActions = ["src/actions/generate-auth-token-AEK/generate-auth-token.json",
    "src/actions/convert-webhook-payload-to-html-convert_webhook/convert-webhook-payload-to-html.json"].map(json);
const plugin = json("src/plugin.json");
const pluginNames = new Set([
    ...Object.values(element.fields).map((field) => field.caption),
    ...Object.values(element.states).map((state) => state.caption),
    ...Object.values(element.events).map((event) => event.caption),
    ...Object.values(element.actions).map((action) => action.caption),
    ...serverActions.flatMap((action) => [
        action.display,
        ...Object.values(action.fields || {}).map((field) => field.caption),
        ...Object.values(action.return_value || {}).map((value) => value.caption),
    ]),
    ...Object.values(plugin.shared_keys).map((key) => key.caption),
]);
// Bubble's own labels, not the plugin's. Keep this list short and exact.
const bubbleNames = new Set([
    "File uploads enabled",
    "Make changes to a thing",
    "ID Attribute",
    "Page is loaded",
    "Set state",
    "Only when",
]);
const boldTerms = [...recipes.matchAll(/\*\*([^*]+)\*\*/g)].map((match) => match[1].replace(/\s+/g, " ").trim());
assert.ok(boldTerms.length > 20, "recipes name the settings they use");
const unknown = [...new Set(boldTerms.filter((term) => !pluginNames.has(term) && !bubbleNames.has(term)))];
assert.deepEqual(unknown, [], "bold terms must be real plugin or Bubble names");

// Each recipe that places an editor says what File uploads enabled is set to.
const sections = recipes.split(/^## /m).slice(1).map((section) => ({
    title: section.split("\n")[0].trim(),
    body: section,
}));
const recipeSections = sections.filter((section) => /^Recipe/.test(section.title));
assert.ok(recipeSections.length >= 5, "save, autobinding, menus, read-only and collaboration recipes");
for (const section of recipeSections) {
    assert.match(section.body, /\*\*File uploads enabled\*\*: (yes|no)/, `${section.title}: File uploads enabled is explicit`);
    const evidence = [...section.body.matchAll(/`lib\/tests\/([\w-]+\.mjs)`/g)].map((match) => match[1]);
    assert.ok(evidence.length > 0, `${section.title}: cites the lifecycle test that covers it`);
    for (const file of evidence) {
        assert.ok(existsSync(resolve(libRoot, "tests", file)), `${section.title}: ${file} exists`);
        assert.ok(json("lib/package.json").scripts.test.includes(`tests/${file}`), `${section.title}: ${file} runs in npm test`);
    }
}

// Numbers in the recipes match the element's real defaults.
const defaults = Object.fromEntries(Object.values(element.fields).map((field) => [field.caption, field.default_val]));
assert.equal(defaults["Autobinding save delay"], 2200);
assert.equal(defaults["Update delay"], 300);
assert.match(recipes, /\*\*Autobinding save delay\*\*[^\n]*2200 ms/);
assert.match(recipes, /\*\*Update delay\*\*[^\n]*300 ms/);

// Liveblocks is excluded from these recipes and their tests (maintainer, 2026-09-26).
assert.doesNotMatch(recipes, /\*\*Liveblocks key\*\*/, "no Liveblocks setup steps");

console.log(`PASS recipes docs contract (${boldTerms.length} bold terms, ${recipeSections.length} recipes)`);
