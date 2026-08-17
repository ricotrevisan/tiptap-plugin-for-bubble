import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const libRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = resolve(libRoot, "..");
const element = JSON.parse(readFileSync(resolve(root, "src/elements/tiptap-AAC/AAC.json"), "utf8"));
const plugin = JSON.parse(readFileSync(resolve(root, "src/plugin.json"), "utf8"));
const packageManifest = JSON.parse(readFileSync(resolve(libRoot, "package.json"), "utf8"));
assert.equal(packageManifest.dependencies["@tiptap/ai-toolkit"], undefined);
assert.equal(packageManifest.devDependencies["@tiptap/ai-toolkit"], "0.3.0");

assert.equal(element.fields.ext_ai_toolkit.default_val, false);
assert.match(element.fields.ext_ai_toolkit.doc, /does not call Tiptap, invoke AI, or execute tools/i);
assert.equal(element.states.ai_editor_context.value, "text");
assert.equal(element.states.ai_context_error.value, "text");
assert.equal(element.events.ai_editor_context_ready.name, "ai_editor_context_ready");
assert.equal(element.events.ai_editor_context_failed.name, "ai_editor_context_failed");
assert.ok(element.actions.refresh_ai_editor_context);
assert.ok(existsSync(resolve(root, "src/elements/tiptap-AAC/actions/refresh-ai-editor-context-refresh_ai_editor_context.js")));

function uniqueRanks(entries, label) {
    const ranks = Object.values(entries).map((entry) => entry.rank);
    assert.equal(new Set(ranks).size, ranks.length, `${label} contains duplicate ranks`);
}
uniqueRanks(element.fields, "element fields");

for (const caption of [
    "Tiptap AI environment ID",
    "Tiptap AI ES256 private key",
    "Tiptap AI API base URL",
]) {
    const setting = Object.values(plugin.shared_keys).find((entry) => entry.caption === caption);
    assert.ok(setting, `missing plugin setting ${caption}`);
    assert.equal(setting.type, "secure");
    assert.equal(Object.hasOwn(setting, "value"), false);
}

const actionPaths = [
    "src/actions/fetch-ai-toolkit-tools-fetch_ai_toolkit_tools/fetch-ai-toolkit-tools.json",
    "src/actions/execute-ai-toolkit-tool-execute_ai_toolkit_tool/execute-ai-toolkit-tool.json",
];
for (const actionPath of actionPaths) {
    const action = JSON.parse(readFileSync(resolve(root, actionPath), "utf8"));
    assert.equal(action.type, "server_side");
    uniqueRanks(action.fields, `${action.display} fields`);
    uniqueRanks(action.return_value, `${action.display} return values`);
    for (const output of ["success", "status_code", "error_code", "error_message"]) {
        assert.ok(Object.values(action.return_value).some((entry) => entry.name === output));
    }
}

const encoded = spawnSync("pled", ["encode"], { cwd: root, encoding: "utf8" });
assert.equal(encoded.status, 0, encoded.stdout + encoded.stderr);
const artifact = JSON.parse(readFileSync(resolve(root, "dist/plugin.json"), "utf8"));
const encodedElement = artifact.plugin_elements.AAC;
assert.ok(encodedElement.actions.refresh_ai_editor_context.code.fn.includes("refreshAiEditorContext"));
assert.ok(encodedElement.states.ai_editor_context);
assert.ok(encodedElement.states.ai_context_error);
assert.ok(encodedElement.events.ai_editor_context_ready);
assert.ok(encodedElement.events.ai_editor_context_failed);
assert.equal(artifact.plugin_actions.fetch_ai_toolkit_tools.type, "server_side");
assert.equal(artifact.plugin_actions.execute_ai_toolkit_tool.type, "server_side");

const encodedText = JSON.stringify(artifact);
assert.doesNotMatch(encodedText, /-----BEGIN (?:EC |)PRIVATE KEY-----/);
assert.doesNotMatch(encodedText, /env_test|block-hash-1|secret-data/);

const browserBundle = readFileSync(resolve(libRoot, "dist.js"));
const CORE_BUNDLE_MAX_BYTES = 1_120_000;
assert.ok(browserBundle.byteLength < CORE_BUNDLE_MAX_BYTES, `normal editor bundle unexpectedly grew to ${browserBundle.byteLength} bytes`);
const browserText = browserBundle.toString("utf8");
assert.doesNotMatch(browserText, /Tiptap AI ES256 private key|Tiptap AI environment ID/);
assert.doesNotMatch(browserText, /\/v4\/ai\/toolkit\/(?:fetch-tools|execute-tool)/);
assert.doesNotMatch(browserText, /serializedSchema|Block container preserved from unknown HTML div elements/);
assert.match(browserText, /https:\/\/cdn\.jsdelivr\.net\/npm\/@tiptap\/ai-toolkit@0\.3\.0\/\+esm/);
assert.equal(existsSync(resolve(libRoot, "vendor/TIPTAP_AI_TOOLKIT_LICENSE.md")), true);

console.log(JSON.stringify({
    encodedMetadata: true,
    ranksUnique: true,
    secureSettings: true,
    serverActionsExposed: true,
    browserCredentialsAbsent: true,
    editorContextLazyLoaded: true,
    normalBundleBytes: browserBundle.byteLength,
}));
