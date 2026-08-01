import { Extension } from "@tiptap/core";

// Compatibility-only subset of @tiptap/ai-toolkit@0.3.0's MIT-licensed
// ServerAiToolkit. Bundling the package root also pulls its schema-validation
// stack into every editor, even when the Bubble toggle is off. Keep this small
// extension aligned with upstream's server-ai-toolkit-extension.ts and
// hash-extension/server-ai-toolkit-hash-extension.ts.
const ATTRIBUTE_NAME = "_hash";

const ServerAiToolkitHashExtension = Extension.create({
    name: "serverAiToolkitHash",

    addGlobalAttributes() {
        if (this.extensions.some((extension) => extension.name === "aiToolkit")) {
            return [];
        }

        const types = this.extensions
            .filter((extension) => {
                if (
                    extension.type !== "node" ||
                    extension.name === "text" ||
                    extension.name === "doc" ||
                    extension.name === "tableHeader" ||
                    extension.name === "tableCell" ||
                    (typeof extension.config?.group === "string" && extension.config.group.includes("inline"))
                ) {
                    return false;
                }
                return true;
            })
            .map((extension) => extension.name);

        return [
            {
                types,
                attributes: {
                    [ATTRIBUTE_NAME]: {
                        default: null,
                        parseHTML: (element) => element.getAttribute(ATTRIBUTE_NAME),
                        renderHTML: (attributes) => {
                            if (!attributes[ATTRIBUTE_NAME]) return {};
                            return { [ATTRIBUTE_NAME]: attributes[ATTRIBUTE_NAME] };
                        },
                    },
                },
            },
        ];
    },
});

const ServerAiToolkit = Extension.create({
    name: "serverAiToolkit",

    addExtensions() {
        return [ServerAiToolkitHashExtension];
    },
});

export default ServerAiToolkit;
