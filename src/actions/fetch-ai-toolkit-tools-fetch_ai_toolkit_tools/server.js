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
        system_prompt: "",
        tools_json: "[]",
        ...overrides,
    };
}

function parseObject(raw, label, code) {
    if (typeof raw !== "string" || raw.trim() === "") {
        throw { code, message: label + " is required." };
    }
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

function accessToken(config) {
    try {
        return jsonwebtoken.sign(
            { permissions: [{ action: "AI:Toolkit", resource: "*" }] },
            config.privateKey,
            {
                algorithm: "ES256",
                issuer: config.environmentId,
                audience: ["AI"],
                expiresIn: "30m",
            },
        );
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
    const requestedTools = String(properties.tool_allowlist || "")
        .split(/[,\n]/)
        .map((name) => name.trim())
        .filter(Boolean);
    const tools = {};
    for (const name of requestedTools) {
        if (!SUPPORTED_TOOLS.has(name)) {
            return result({
                error_code: "unsupported_tool",
                error_message: 'Unsupported AI Toolkit tool "' + name + '". Use only documented v4 tool names.',
            });
        }
        tools[name] = true;
    }

    const config = configuration(context);
    const token = accessToken(config);
    let response;
    try {
        response = await fetch(config.baseUrl + "/v4/ai/toolkit/fetch-tools", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: "Bearer " + token,
            },
            body: JSON.stringify({ editorContext, tools, format: "json" }),
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
    if (typeof payload.systemPrompt !== "string" || !Array.isArray(payload.tools)) {
        return result({
            status_code: response.status,
            error_code: "invalid_response",
            error_message: "Tiptap AI Toolkit returned an unexpected tool-definition response.",
        });
    }
    return result({
        success: true,
        status_code: response.status,
        error_code: "",
        error_message: "",
        system_prompt: payload.systemPrompt,
        tools_json: JSON.stringify(payload.tools),
    });
} catch (error) {
    return result({
        error_code: error && error.code ? String(error.code) : "invalid_request",
        error_message: error && error.message ? String(error.message) : "The AI Toolkit request is invalid.",
    });
}
