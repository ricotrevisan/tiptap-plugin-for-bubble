const { inspect } = require("node:util");

try {
    // ── 1. Set up a DOM environment for generateHTML ─────────────────
    // Tiptap's generateHTML uses ProseMirror's DOMSerializer which requires
    // a document object. On the server we provide one via jsdom.
    const { JSDOM } = require("jsdom");
    const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
    global.document = dom.window.document;
    global.window = dom.window;
    global.navigator = dom.window.navigator;

    // ── 2. Import Tiptap libraries ───────────────────────────────────
    const { generateHTML, mergeAttributes, Node } = require("@tiptap/core");
    const { StarterKit } = require("@tiptap/starter-kit");

    // Extensions beyond StarterKit that the plugin supports
    const { TextStyle } = require("@tiptap/extension-text-style");
    const Color = require("@tiptap/extension-color").default;
    const FontFamily = require("@tiptap/extension-font-family").default;
    const FontSize = require("@tiptap/extension-font-size").default;
    const Highlight = require("@tiptap/extension-highlight").default;
    const TextAlign = require("@tiptap/extension-text-align").default;
    const Image = require("@tiptap/extension-image").default;
    const Youtube = require("@tiptap/extension-youtube").default;
    const { Table, TableRow, TableHeader, TableCell } = require("@tiptap/extension-table");
    const TaskList = require("@tiptap/extension-task-list").default;
    const TaskItem = require("@tiptap/extension-task-item").default;
    const Mention = require("@tiptap/extension-mention").default;
    const Subscript = require("@tiptap/extension-subscript").default;
    const Superscript = require("@tiptap/extension-superscript").default;
    const Details = require("@tiptap/extension-details").default;
    const { DetailsContent, DetailsSummary } = require("@tiptap/extension-details");

    const AlignableImage = Image.extend({
        renderHTML({ HTMLAttributes }) {
            const alignment = /text-align:\s*(left|center|right)/.exec(HTMLAttributes.style || "")?.[1];
            const margins = {
                left: "margin-left: 0; margin-right: auto",
                center: "margin-left: auto; margin-right: auto",
                right: "margin-left: auto; margin-right: 0",
            }[alignment];
            const alignedAttributes = margins
                ? mergeAttributes(HTMLAttributes, { style: `display: block; ${margins}` })
                : HTMLAttributes;

            return ["img", mergeAttributes(this.options.HTMLAttributes, alignedAttributes)];
        },
    });

    // Mathematics (WTF-234): the editor's inlineMath/blockMath HTML, with the raw
    // LaTeX as text. Defined here so the action needs neither KaTeX nor a new package.
    const mathNode = (name, group, tag, type) => Node.create({
        name,
        group,
        inline: group === "inline",
        atom: true,
        addAttributes() {
            return { latex: { default: "", renderHTML: (attributes) => ({ "data-latex": attributes.latex }) } };
        },
        renderHTML({ node, HTMLAttributes }) {
            return [tag, mergeAttributes(HTMLAttributes, { "data-type": type }), node.attrs.latex || ""];
        },
    });

    // ── 3. Build the extensions array ────────────────────────────────
    // This mirrors the extensions available in the client-side editor so
    // that every node/mark type can be serialized to HTML correctly.
    const extensions = [
        StarterKit,
        TextStyle,
        Color,
        FontFamily,
        FontSize,
        Highlight.configure({ multicolor: true }),
        TextAlign.configure({ types: ["heading", "paragraph", "image"] }),
        AlignableImage,
        Youtube,
        Table,
        TableRow,
        TableHeader,
        TableCell,
        TaskList,
        TaskItem,
        Mention,
        Subscript,
        Superscript,
        Details,
        DetailsContent,
        DetailsSummary,
        mathNode("inlineMath", "inline", "span", "inline-math"),
        mathNode("blockMath", "block", "div", "block-math"),
    ];

    // ── 4. Parse the input ───────────────────────────────────────────
    const raw = properties.payload;
    if (!raw || raw.trim() === "") {
        return {
            html: "",
            error: "The payload is empty. Pass the webhook body or the ProseMirror JSON document.",
            returned_an_error: true,
        };
    }

    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch (e) {
        return {
            html: "",
            error: "Failed to parse input as JSON: " + e.message,
            returned_an_error: true,
        };
    }

    const fieldName = (properties.field_name || "default").trim();

    // ── 5. Detect input format and extract ProseMirror JSON ──────────
    //
    // Supported formats:
    //
    // A) Full Hocuspocus webhook body:
    //    { "event": "change", "payload": { "document": { "default": { "type": "doc", ... } }, "documentName": "..." } }
    //
    // B) Just the document object (multiple fields):
    //    { "default": { "type": "doc", ... } }
    //
    // C) Raw ProseMirror JSON:
    //    { "type": "doc", "content": [...] }

    let prosemirrorJSON;

    if (parsed.type === "doc") {
        // Format C — raw ProseMirror JSON
        prosemirrorJSON = parsed;
    } else if (parsed.event && parsed.payload && parsed.payload.document) {
        // Format A — full webhook body
        const doc = parsed.payload.document;
        if (doc[fieldName]) {
            prosemirrorJSON = doc[fieldName];
        } else if (doc.type === "doc") {
            // The document itself is already the ProseMirror JSON (single-field setup)
            prosemirrorJSON = doc;
        } else {
            // Try the first available field
            const keys = Object.keys(doc);
            if (keys.length === 1) {
                prosemirrorJSON = doc[keys[0]];
            } else {
                return {
                    html: "",
                    error: `Could not find field "${fieldName}" in the webhook document. Available fields: ${keys.join(", ")}. Set the "Field name" parameter to one of these.`,
                    returned_an_error: true,
                };
            }
        }
    } else if (parsed[fieldName] && parsed[fieldName].type === "doc") {
        // Format B — document object with named fields
        prosemirrorJSON = parsed[fieldName];
    } else {
        // Last resort: check if any top-level key contains a doc
        const keys = Object.keys(parsed);
        const docKey = keys.find((k) => parsed[k] && parsed[k].type === "doc");
        if (docKey) {
            prosemirrorJSON = parsed[docKey];
        } else {
            return {
                html: "",
                error: 'Unrecognized input format. Expected a Hocuspocus webhook body, a document object with field names, or raw ProseMirror JSON (with "type": "doc"). Check that the correct JSON is being passed.',
                returned_an_error: true,
            };
        }
    }

    // ── 6. Validate the ProseMirror JSON ─────────────────────────────
    if (!prosemirrorJSON || prosemirrorJSON.type !== "doc" || !Array.isArray(prosemirrorJSON.content)) {
        return {
            html: "",
            error: 'The extracted document JSON is invalid. Expected an object with "type": "doc" and a "content" array. Got: ' + JSON.stringify(prosemirrorJSON).substring(0, 200),
            returned_an_error: true,
        };
    }

    // ── 7. Generate HTML ─────────────────────────────────────────────
    const html = generateHTML(prosemirrorJSON, extensions);

    return {
        html: html,
        error: "",
        returned_an_error: false,
    };
} catch (error) {
    console.error("Error in convert-webhook-payload-to-html:", inspect(error));
    return {
        html: "",
        error: "Unexpected error during conversion: " + inspect(error),
        returned_an_error: true,
    };
}