import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const libRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = resolve(libRoot, "..");
const require = createRequire(resolve(libRoot, "package.json"));
const jwt = require("jsonwebtoken");
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" });
const publicKeyPem = publicKey.export({ type: "spki", format: "pem" });

const keys = {
    "Tiptap AI environment ID": "env_test",
    "Tiptap AI ES256 private key": privateKeyPem.replace(/\n/g, "\\n"),
    "Tiptap AI API base URL": "https://on-prem.example.test/root/",
};

async function runAction(relativePath, properties, fetchImpl, keysOverride = keys) {
    const source = readFileSync(resolve(root, relativePath), "utf8");
    const fn = new AsyncFunction("properties", "context", "require", "fetch", source);
    return fn(properties, { keys: keysOverride }, require, fetchImpl);
}

function response(status, body, statusText = status === 200 ? "OK" : "Error") {
    return {
        ok: status >= 200 && status < 300,
        status,
        statusText,
        async text() { return JSON.stringify(body); },
    };
}

function verifiedToken(header, expectedAudience) {
    assert.match(header, /^Bearer /);
    return jwt.verify(header.slice(7), publicKeyPem, {
        algorithms: ["ES256"],
        issuer: "env_test",
        audience: expectedAudience,
    });
}

let request;
const fetchSuccess = async (url, options) => {
    request = { url, options, body: JSON.parse(options.body) };
    return response(200, {
        systemPrompt: "Use Tiptap JSON.",
        tools: [{ name: "tiptapRead", description: "Read", inputSchema: { type: "object" } }],
    });
};

const fetchResult = await runAction(
    "src/actions/fetch-ai-toolkit-tools-fetch_ai_toolkit_tools/server.js",
    {
        editor_context_json: JSON.stringify({ serializedSchema: { nodes: {}, marks: {} }, items: [] }),
        tool_allowlist: "tiptapRead, tiptapEdit",
    },
    fetchSuccess,
);
assert.deepEqual(fetchResult, {
    success: true,
    status_code: 200,
    error_code: "",
    error_message: "",
    system_prompt: "Use Tiptap JSON.",
    tools_json: JSON.stringify([{ name: "tiptapRead", description: "Read", inputSchema: { type: "object" } }]),
});
assert.equal(request.url, "https://on-prem.example.test/root/v4/ai/toolkit/fetch-tools");
assert.deepEqual(request.body.tools, { tiptapRead: true, tiptapEdit: true });
assert.equal(request.body.format, "json");
assert.deepEqual(Object.keys(request.body).sort(), ["editorContext", "format", "tools"]);
const fetchClaims = verifiedToken(request.options.headers.Authorization, "AI");
assert.equal(fetchClaims.iss, "env_test");
assert.deepEqual(fetchClaims.aud, ["AI"]);
assert.deepEqual(fetchClaims.permissions, [{ action: "AI:Toolkit", resource: "*" }]);
assert.ok(fetchClaims.exp - fetchClaims.iat <= 30 * 60);
assert.ok(fetchClaims.exp > fetchClaims.iat);

// A blank allowlist must not silently enable the recommended tools.
await runAction(
    "src/actions/fetch-ai-toolkit-tools-fetch_ai_toolkit_tools/server.js",
    { editor_context_json: '{"serializedSchema":{},"items":[]}', tool_allowlist: "" },
    async (_url, options) => {
        assert.deepEqual(JSON.parse(options.body).tools, {});
        return response(200, { systemPrompt: "", tools: [] });
    },
);

let called = false;
const invalidAllowlist = await runAction(
    "src/actions/fetch-ai-toolkit-tools-fetch_ai_toolkit_tools/server.js",
    { editor_context_json: "{}", tool_allowlist: "deleteEverything" },
    async () => { called = true; },
);
assert.equal(called, false);
assert.equal(invalidAllowlist.success, false);
assert.equal(invalidAllowlist.error_code, "unsupported_tool");
assert.match(invalidAllowlist.error_message, /deleteEverything/);

const missingConfig = await runAction(
    "src/actions/fetch-ai-toolkit-tools-fetch_ai_toolkit_tools/server.js",
    { editor_context_json: "{}", tool_allowlist: "tiptapRead" },
    async () => { called = true; },
    {},
);
assert.equal(missingConfig.success, false);
assert.equal(missingConfig.error_code, "missing_configuration");
assert.equal(missingConfig.status_code, 0);
assert.doesNotMatch(JSON.stringify(missingConfig), /PRIVATE KEY/);
const malformedConfig = await runAction(
    "src/actions/fetch-ai-toolkit-tools-fetch_ai_toolkit_tools/server.js",
    { editor_context_json: "{}", tool_allowlist: "tiptapRead" },
    async () => { throw new Error("must not call"); },
    {
        "Tiptap AI environment ID": "env_test",
        "Tiptap AI ES256 private key": "not-a-private-key",
    },
);
assert.equal(malformedConfig.success, false);
assert.equal(malformedConfig.error_code, "invalid_configuration");
assert.doesNotMatch(JSON.stringify(malformedConfig), /not-a-private-key/);
const insecureBaseUrl = await runAction(
    "src/actions/fetch-ai-toolkit-tools-fetch_ai_toolkit_tools/server.js",
    { editor_context_json: "{}", tool_allowlist: "tiptapRead" },
    async () => { throw new Error("must not call"); },
    { ...keys, "Tiptap AI API base URL": "http://on-prem.example.test" },
);
assert.equal(insecureBaseUrl.success, false);
assert.equal(insecureBaseUrl.error_code, "invalid_base_url");
assert.match(insecureBaseUrl.error_message, /HTTPS/);

const apiFailure = await runAction(
    "src/actions/fetch-ai-toolkit-tools-fetch_ai_toolkit_tools/server.js",
    { editor_context_json: "{}", tool_allowlist: "tiptapRead" },
    async () => response(403, { error: { code: "feature_not_available", message: "Not entitled", status: 403 } }),
);
assert.deepEqual(apiFailure, {
    success: false,
    status_code: 403,
    error_code: "feature_not_available",
    error_message: "Not entitled",
    system_prompt: "",
    tools_json: "[]",
});

let executeRequest;
const inlineResult = await runAction(
    "src/actions/execute-ai-toolkit-tool-execute_ai_toolkit_tool/server.js",
    {
        editor_context_json: '{"serializedSchema":{},"items":[]}',
        tool_call_json: '{"name":"tiptapEdit","input":{"operations":[]},"config":{"chunkSize":100}}',
        document_mode: "Inline",
        inline_document_json: '{"type":"doc","content":[{"type":"paragraph"}]}',
        user_id: "bubble-user-1",
    },
    async (url, options) => {
        executeRequest = { url, options, body: JSON.parse(options.body) };
        return response(200, {
            tool: { name: "tiptapEdit", output: { success: true } },
            docChanged: true,
            document: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Updated" }] }] },
        });
    },
);
assert.equal(inlineResult.success, true);
assert.equal(inlineResult.document_changed, true);
assert.deepEqual(JSON.parse(inlineResult.updated_document_json), {
    type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Updated" }] }],
});
assert.deepEqual(JSON.parse(inlineResult.tool_output_json), { success: true });
assert.deepEqual(JSON.parse(inlineResult.tool_result_json), { name: "tiptapEdit", output: { success: true } });
let appliedInlineDocument;
const setContentSource = readFileSync(resolve(root, "src/elements/tiptap-AAC/actions/set-content-ACW.js"), "utf8");
const setContent = new Function("instance", "properties", "context", setContentSource);
setContent({ data: {
    editor_is_ready: true,
    editor: { commands: { setContent(content) { appliedInlineDocument = content; } } },
}}, {
    content: inlineResult.updated_document_json,
    is_json: true,
    parseOptions_preserveWhitespace: "'full'",
}, { reportToDebugger(message) { throw new Error(message); } });
assert.deepEqual(appliedInlineDocument, JSON.parse(inlineResult.updated_document_json));
assert.equal(executeRequest.url, "https://on-prem.example.test/root/v4/ai/toolkit/execute-tool");
assert.deepEqual(executeRequest.body.document, {
    type: "inline", content: { type: "doc", content: [{ type: "paragraph" }] },
});
assert.deepEqual(executeRequest.body.tool, {
    name: "tiptapEdit", input: { operations: [] }, config: { chunkSize: 100 },
});
assert.equal(executeRequest.body.user, "bubble-user-1");
const inlineClaims = verifiedToken(executeRequest.options.headers.Authorization, "AI");
assert.deepEqual(inlineClaims.aud, ["AI"]);
assert.deepEqual(inlineClaims.permissions, [{ action: "AI:Toolkit", resource: "*" }]);

const collaborativeResult = await runAction(
    "src/actions/execute-ai-toolkit-tool-execute_ai_toolkit_tool/server.js",
    {
        editor_context_json: "{}",
        tool_call_json: '{"name":"tiptapRead","input":{"from":0}}',
        document_mode: "Collaborative",
        collaborative_document_id: "doc_exact",
        collaborative_field: "body",
    },
    async (_url, options) => {
        const body = JSON.parse(options.body);
        assert.deepEqual(body.document, { type: "cloud", id: "doc_exact" });
        assert.equal(body.field, "body");
        const claims = verifiedToken(options.headers.Authorization, "Documents");
        assert.deepEqual(claims.aud, ["AI", "Documents"]);
        assert.deepEqual(claims.permissions, [
            { action: "AI:Toolkit", resource: "*" },
            { action: "Documents:Write", resource: "doc_exact" },
        ]);
        return response(200, {
            tool: { name: "tiptapRead", output: { success: true } },
            docChanged: true,
            document: { type: "doc", content: [] },
        });
    },
);
assert.equal(collaborativeResult.success, true);
assert.equal(collaborativeResult.updated_document_json, "");
assert.equal(collaborativeResult.document_changed, true);

const missingChangedInlineDocument = await runAction(
    "src/actions/execute-ai-toolkit-tool-execute_ai_toolkit_tool/server.js",
    { editor_context_json: "{}", tool_call_json: '{"name":"tiptapEdit","input":{}}', document_mode: "Inline", inline_document_json: '{"type":"doc","content":[]}' },
    async () => response(200, { tool: { name: "tiptapEdit", output: {} }, docChanged: true, document: null }),
);
assert.equal(missingChangedInlineDocument.success, false);
assert.equal(missingChangedInlineDocument.error_code, "invalid_response");
assert.match(missingChangedInlineDocument.error_message, /without returning updated document JSON/);

const invalidInline = await runAction(
    "src/actions/execute-ai-toolkit-tool-execute_ai_toolkit_tool/server.js",
    { editor_context_json: "{}", tool_call_json: '{"name":"tiptapRead","input":{}}', document_mode: "Inline", inline_document_json: "not json" },
    async () => { throw new Error("must not call"); },
);
assert.equal(invalidInline.success, false);
assert.equal(invalidInline.error_code, "invalid_document_json");

const noCloudId = await runAction(
    "src/actions/execute-ai-toolkit-tool-execute_ai_toolkit_tool/server.js",
    { editor_context_json: "{}", tool_call_json: '{"name":"tiptapRead","input":{}}', document_mode: "Collaborative" },
    async () => { throw new Error("must not call"); },
);
assert.equal(noCloudId.error_code, "missing_document_id");

const networkFailure = await runAction(
    "src/actions/execute-ai-toolkit-tool-execute_ai_toolkit_tool/server.js",
    { editor_context_json: "{}", tool_call_json: '{"name":"tiptapRead","input":{}}', document_mode: "Inline", inline_document_json: '{"type":"doc","content":[]}' },
    async () => { throw new Error("connect ECONNREFUSED secret-data"); },
);
assert.equal(networkFailure.success, false);
assert.equal(networkFailure.error_code, "request_failed");
assert.equal(networkFailure.error_message, "The Tiptap AI Toolkit request could not be completed.");
assert.doesNotMatch(JSON.stringify(networkFailure), /secret-data/);

console.log(JSON.stringify({
    fetchContract: true,
    executeInlineContract: true,
    inlineAppliedThroughSetContent: true,
    executeCollaborativeContract: true,
    es256ClaimsVerified: true,
    structuredErrors: true,
}));
