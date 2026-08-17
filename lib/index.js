import { Editor, mergeAttributes, generateHTML, Extension, Node } from "@tiptap/core";
import Document from "@tiptap/extension-document";
import HardBreak from "@tiptap/extension-hard-break";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import Heading from "@tiptap/extension-heading";
import Bold from "@tiptap/extension-bold";
import Code from "@tiptap/extension-code";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Italic from "@tiptap/extension-italic";
import Strike from "@tiptap/extension-strike";
import Blockquote from "@tiptap/extension-blockquote";
import BulletList from "@tiptap/extension-bullet-list";
import CodeBlock from "@tiptap/extension-code-block";
import HorizontalRule from "@tiptap/extension-horizontal-rule";
import ListItem from "@tiptap/extension-list-item";
import OrderedList from "@tiptap/extension-ordered-list";

import { CharacterCount, Dropcursor, Gapcursor, UndoRedo, Placeholder, TrailingNode, Focus, Selection } from "@tiptap/extensions";

import Youtube from "@tiptap/extension-youtube";
import Underline from "@tiptap/extension-underline";
import { Table, TableRow, TableHeader, TableCell } from "@tiptap/extension-table";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import BubbleMenu from "@tiptap/extension-bubble-menu";
import FloatingMenu from "@tiptap/extension-floating-menu";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import Mention from "@tiptap/extension-mention";
import Suggestion from "@tiptap/suggestion";
import FontFamily from "@tiptap/extension-font-family";
import { TextStyle, LineHeight, BackgroundColor } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import tippy from "tippy.js";
import FileHandler from "@tiptap/extension-file-handler";
import UniqueID from "@tiptap/extension-unique-id";
import { ServerAiToolkit } from "./vendor/tiptap-ai-toolkit-schema-adapter.js";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import Typography from "@tiptap/extension-typography";
import ListKeymap from "@tiptap/extension-list-keymap";
import FontSize from "@tiptap/extension-font-size";
import Resizable from "./vendor/tiptap-extension-resizable.js";
import Details, { DetailsContent, DetailsSummary } from "@tiptap/extension-details";
import InvisibleCharacters from "@tiptap/extension-invisible-characters";
import DragHandle from "@tiptap/extension-drag-handle";
import FindAndReplace from "@tiptap/extension-find-and-replace";

// Collaboration libraries
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import { HocuspocusProvider } from "@hocuspocus/provider";
import * as Y from "yjs";
import { createClient } from "@liveblocks/client";
import { LiveblocksYjsProvider as LiveblocksProvider } from "@liveblocks/yjs";

// Editor-context generation carries the larger Zod/schema-awareness graph.
// Load the pinned official module only for AI-enabled editors or explicit refreshes.
const AI_EDITOR_CONTEXT_MODULE_URL = "https://cdn.jsdelivr.net/npm/@tiptap/ai-toolkit@0.3.0/+esm";
let aiEditorContextModulePromise;
async function loadAiEditorContextGenerator() {
    if (!aiEditorContextModulePromise) {
        aiEditorContextModulePromise = import(AI_EDITOR_CONTEXT_MODULE_URL)
            .then((module) => {
                if (typeof module.getEditorContext !== "function") {
                    throw new Error("AI editor-context module did not export getEditorContext");
                }
                return module.getEditorContext;
            })
            .catch((error) => {
                aiEditorContextModulePromise = undefined;
                throw error;
            });
    }
    return aiEditorContextModulePromise;
}

// Export everything to window.tiptap object
window.tiptap = {
    // Core
    Editor,
    Node,
    Extension,
    mergeAttributes,
    generateHTML,

    // Basic nodes
    Document,
    HardBreak,
    Paragraph,
    Text,

    // Formatting
    Bold,
    Italic,
    Strike,
    Underline,
    Code,

    // Block elements
    Heading,
    Blockquote,
    CodeBlock,
    CodeBlockLowlight,
    HorizontalRule,

    // Lists
    BulletList,
    OrderedList,
    ListItem,
    TaskList,
    TaskItem,

    // Advanced
    Image,
    Link,
    Youtube,
    Table,
    TableRow,
    TableHeader,
    TableCell,

    // Styling
    FontFamily,
    Color,
    TextStyle,
    LineHeight,
    BackgroundColor,
    TextAlign,
    Highlight,

    // Interaction
    BubbleMenu,
    FloatingMenu,
    Mention,
    Suggestion,

    // Utilities
    CharacterCount,
    Dropcursor,
    Gapcursor,
    UndoRedo,
    Placeholder,
    TrailingNode,
    Focus,
    Selection,
    FileHandler,
    UniqueID,
    ServerAiToolkit,
    loadAiEditorContextGenerator,

    // Phase 2 extensions
    Subscript,
    Superscript,
    Typography,
    ListKeymap,
    FontSize,
    Resizable,
    Details,
    DetailsContent,
    DetailsSummary,
    InvisibleCharacters,
    DragHandle,
    FindAndReplace,

    // Collaboration
    Collaboration,
    CollaborationCaret,
    HocuspocusProvider,
    Y,
    createClient,
    LiveblocksProvider,

    // Third-party
    tippy,
};

// Export CollaborationCaret as tiptapCollaborationCaret for backward compatibility
// window.tiptapCollaborationCaret = CollaborationCaret;
