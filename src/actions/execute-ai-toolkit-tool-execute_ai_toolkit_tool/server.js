const jsonwebtoken = require("jsonwebtoken");

const SUPPORTED_TOOLS = new Set([
    "tiptapRead",
    "tiptapEdit",
    "getThreads",
    "editThreads",
    "readDocument",
    "readSelection",
    "proofread",
]);

function result(overrides = {}) {
    return {
        success: false,
        status_code: 0,
        error_code: "unknown_error",
        error_message: "The Tiptap AI Toolkit request failed.",
        tool_result_json: "",
        tool_output_json: "",
        document_changed: false,
        updated_document_json: "",
        ...overrides,
    };
}

function parseObject(raw, label, code) {
    if (typeof raw !== "string" || raw.trim() === "") throw { code, message: label + " is required." };
    try {
        const value = JSON.parse(raw);
        if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected a JSON object");
        return value;
    } catch (error) {
        throw { code, message: label + " must be a valid JSON object." };
    }
}

function configuration(context) {
    const keys = context.keys || {};
    const environmentId = String(keys["Tiptap AI environment ID"] || "").trim();
    const privateKey = String(keys["Tiptap AI ES256 private key"] || "").trim().replace(/\\n/g, "\n");
    const configuredBaseUrl = String(keys["Tiptap AI API base URL"] || "").trim();
    if (!environmentId || !privateKey) {
        throw {
            code: "missing_configuration",
            message: "Configure the Tiptap AI environment ID and ES256 private key in the plugin settings.",
        };
    }
    const baseUrl = (configuredBaseUrl || "https://api.tiptap.dev").replace(/\/+$/, "");
    let parsedUrl;
    try {
        parsedUrl = new URL(baseUrl);
    } catch (error) {
        throw { code: "invalid_base_url", message: "The configured Tiptap AI API base URL is invalid." };
    }
    if (parsedUrl.protocol !== "https:") {
        throw { code: "invalid_base_url", message: "The Tiptap AI API base URL must use HTTPS." };
    }
    return { environmentId, privateKey, baseUrl };
}

function accessToken(config, documentId) {
    const permissions = [{ action: "AI:Toolkit", resource: "*" }];
    const audience = ["AI"];
    if (documentId) {
        audience.push("Documents");
        permissions.push({ action: "Documents:Write", resource: documentId });
    }
    try {
        return jsonwebtoken.sign({ permissions }, config.privateKey, {
            algorithm: "ES256",
            issuer: config.environmentId,
            audience,
            expiresIn: "30m",
        });
    } catch (error) {
        throw {
            code: "invalid_configuration",
            message: "The Tiptap AI ES256 private key could not be used. Check the plugin settings.",
        };
    }
}

function apiError(status, statusText, payload) {
    const error = payload && payload.error;
    if (error && typeof error === "object") {
        return result({
            status_code: status,
            error_code: String(error.code || "http_" + status),
            error_message: String(error.message || statusText || "Tiptap AI Toolkit request failed."),
        });
    }
    return result({
        status_code: status,
        error_code: "http_" + status,
        error_message: typeof error === "string" ? error : String(statusText || "Tiptap AI Toolkit request failed."),
    });
}

try {
    if (typeof properties.editor_context_json !== "string" || properties.editor_context_json.trim() === "") {
        return result({
            error_code: "missing_editor_context",
            error_message: "AI editor context is required. Enable AI Toolkit compatibility and wait for the context-ready event.",
        });
    }
    const editorContext = parseObject(properties.editor_context_json, "AI editor context", "invalid_editor_context_json");
    const tool = parseObject(properties.tool_call_json, "Tool call", "invalid_tool_call_json");
    if (typeof tool.name !== "string" || !SUPPORTED_TOOLS.has(tool.name)) {
        throw { code: "unsupported_tool", message: "The tool call must use a documented v4 AI Toolkit tool name." };
    }
    if (!tool.input || typeof tool.input !== "object" || Array.isArray(tool.input)) {
        throw { code: "invalid_tool_call_json", message: "The tool call must contain an input JSON object." };
    }

    const normalizedMode = String(properties.document_mode || "").trim().toLowerCase();
    const collaborative = normalizedMode === "collaborative" || normalizedMode === "cloud";
    const inline = normalizedMode === "inline";
    if (!inline && !collaborative) {
        throw { code: "invalid_document_mode", message: 'Document mode must be "Inline" or "Collaborative".' };
    }

    let documentInput;
    let documentId = "";
    if (inline) {
        const content = parseObject(properties.inline_document_json, "Inline document JSON", "invalid_document_json");
        if (content.type !== "doc") {
            throw { code: "invalid_document_json", message: 'Inline document JSON must have type "doc".' };
        }
        documentInput = { type: "inline", content };
    } else {
        documentId = String(properties.collaborative_document_id || "").trim();
        if (!documentId) throw { code: "missing_document_id", message: "A collaborative document ID is required." };
        documentInput = { type: "cloud", id: documentId };
    }

    const config = configuration(context);
    const token = accessToken(config, documentId);
    const body = {
        editorContext,
        document: documentInput,
        tool: { name: tool.name, input: tool.input },
        format: "json",
    };
    if (Object.prototype.hasOwnProperty.call(tool, "config")) body.tool.config = tool.config;
    const userId = String(properties.user_id || "").trim();
    if (userId) body.user = userId;
    const field = String(properties.collaborative_field || "").trim();
    if (collaborative && field && field !== "default") body.field = field;

    let response;
    try {
        response = await fetch(config.baseUrl + "/v4/ai/toolkit/execute-tool", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: "Bearer " + token,
            },
            body: JSON.stringify(body),
        });
    } catch (error) {
        return result({
            error_code: "request_failed",
            error_message: "The Tiptap AI Toolkit request could not be completed.",
        });
    }

    let payload;
    try {
        const text = await response.text();
        payload = text ? JSON.parse(text) : {};
    } catch (error) {
        return result({
            status_code: response.status,
            error_code: "invalid_response",
            error_message: "Tiptap AI Toolkit returned an invalid JSON response.",
        });
    }
    if (!response.ok) return apiError(response.status, response.statusText, payload);
    if (!payload.tool || typeof payload.tool !== "object" || typeof payload.docChanged !== "boolean") {
        return result({
            status_code: response.status,
            error_code: "invalid_response",
            error_message: "Tiptap AI Toolkit returned an unexpected tool-execution response.",
        });
    }
    if (
        inline &&
        payload.docChanged &&
        (!payload.document || typeof payload.document !== "object" || Array.isArray(payload.document) || payload.document.type !== "doc")
    ) {
        return result({
            status_code: response.status,
            error_code: "invalid_response",
            error_message: "Tiptap AI Toolkit reported an inline document change without returning updated document JSON.",
        });
    }
    return result({
        success: true,
        status_code: response.status,
        error_code: "",
        error_message: "",
        tool_result_json: JSON.stringify(payload.tool),
        tool_output_json: JSON.stringify(payload.tool.output === undefined ? null : payload.tool.output),
        document_changed: payload.docChanged,
        updated_document_json: inline && payload.document ? JSON.stringify(payload.document) : "",
    });
} catch (error) {
    return result({
        error_code: error && error.code ? String(error.code) : "invalid_request",
        error_message: error && error.message ? String(error.message) : "The AI Toolkit request is invalid.",
    });
}
