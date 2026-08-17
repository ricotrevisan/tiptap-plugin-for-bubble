/*
 * Adapted from @tiptap/ai-toolkit 0.3.0.
 * Copyright (c) 2025-present, Tiptap GmbH.
 * SPDX-License-Identifier: MIT
 * Source: https://github.com/ueberdosis/tiptap/tree/main/packages/ai-toolkit
 *
 * This small hash/schema adapter stays in the primary editor bundle. Editor-context
 * generation is loaded separately only when the AI path is used.
 */
import { Extension } from "@tiptap/core";

const ATTRIBUTE_NAME = "_hash";

const ServerAiToolkitHashExtension = Extension.create({
    name: "serverAiToolkitHash",
    addGlobalAttributes() {
        if (this.extensions.some((extension) => extension.name === "aiToolkit")) return [];
        const types = this.extensions
            .filter((extension) => {
                if (
                    extension.type !== "node" ||
                    extension.name === "text" ||
                    extension.name === "doc" ||
                    extension.name === "tableHeader" ||
                    extension.name === "tableCell" ||
                    (typeof extension.config?.group === "string" && extension.config.group.includes("inline"))
                ) return false;
                return true;
            })
            .map((extension) => extension.name);
        return [{
            types,
            attributes: {
                [ATTRIBUTE_NAME]: {
                    default: null,
                    parseHTML: (element) => element.getAttribute(ATTRIBUTE_NAME),
                    renderHTML: (attributes) => attributes[ATTRIBUTE_NAME]
                        ? { [ATTRIBUTE_NAME]: attributes[ATTRIBUTE_NAME] }
                        : {},
                },
            },
        }];
    },
});

export const ServerAiToolkit = Extension.create({
    name: "serverAiToolkit",
    addExtensions() {
        return [ServerAiToolkitHashExtension];
    },
});
