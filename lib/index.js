import { Editor, mergeAttributes, generateHTML, Extension, Node } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
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
import Emoji from "@tiptap/extension-emoji";
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
import TableOfContents from "@tiptap/extension-table-of-contents";
import { FindAndReplace } from "@tiptap/extension-find-and-replace";
import { ServerAiToolkit, getEditorContext } from "@tiptap/ai-toolkit";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import Typography from "@tiptap/extension-typography";
import ListKeymap from "@tiptap/extension-list-keymap";
import FontSize from "@tiptap/extension-font-size";
import Resizable from "./vendor/tiptap-extension-resizable.js";
import { createAutobindingSaveController } from "./autobinding-save-controller.js";
import Details, { DetailsContent, DetailsSummary } from "@tiptap/extension-details";
import InvisibleCharacters from "@tiptap/extension-invisible-characters";
import DragHandle from "@tiptap/extension-drag-handle";
// KaTeX is aliased to ./katex-runtime.js at build time; it loads from a CDN only when Mathematics is on.
import { InlineMath, BlockMath } from "@tiptap/extension-mathematics";
import { loadKatex, whenKatexLoaded } from "./katex-runtime.js";

// Collaboration libraries
import Collaboration, { isChangeOrigin } from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import { yCursorPlugin, ySyncPluginKey, absolutePositionToRelativePosition, relativePositionToAbsolutePosition } from "@tiptap/y-tiptap";
import { HocuspocusProvider } from "@hocuspocus/provider";
import * as Y from "yjs";
import { createClient } from "@liveblocks/client";
import { LiveblocksYjsProvider as LiveblocksProvider } from "@liveblocks/yjs";

import { createLowlight, common as commonLanguages } from "lowlight";
import githubTheme from "highlight.js/styles/github.min.css";
import githubDarkTheme from "highlight.js/styles/github-dark.min.css";
import atomOneLightTheme from "highlight.js/styles/atom-one-light.min.css";
import atomOneDarkTheme from "highlight.js/styles/atom-one-dark.min.css";
import monokaiTheme from "highlight.js/styles/monokai.min.css";
import nordTheme from "highlight.js/styles/nord.min.css";
import stackoverflowLightTheme from "highlight.js/styles/stackoverflow-light.min.css";
import tokyoNightDarkTheme from "highlight.js/styles/tokyo-night-dark.min.css";

// highlight.js themes, rewritten for Tiptap code blocks: lowlight colours tokens with
// hljs-* spans but puts no .hljs class on the block, so the .hljs base rule becomes the
// code block itself. Selectors are relative, for nesting inside the editor's stylesheet.
function editorCodeTheme(css) {
    const rules = [];
    css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/([^{}]+)\{([^{}]*)\}/g, (_, selectors, body) => {
        const scoped = selectors.split(",").map((s) => s.trim()).filter((s) => s && !/code\.hljs/.test(s))
            .map((s) => (s === ".hljs" ? ".ProseMirror pre" : ".ProseMirror pre " + s));
        // A themed block gets some room around its code; its own colours follow.
        if (scoped.length === 1 && scoped[0] === ".ProseMirror pre") body = "padding:.75em 1em;border-radius:.375rem;" + body;
        if (scoped.length) rules.push(scoped.join(",") + "{" + body + "}");
        return "";
    });
    return rules.join("\n");
}
const codeThemes = Object.fromEntries(Object.entries({
    // GitHub's code blocks are grey; highlight.js's GitHub theme is white, invisible on a white editor.
    "GitHub": githubTheme.replace(".hljs{color:#24292e;background:#fff}", ".hljs{color:#24292e;background:#f6f8fa}"),
    "GitHub Dark": githubDarkTheme,
    "Atom One Light": atomOneLightTheme,
    "Atom One Dark": atomOneDarkTheme,
    "Monokai": monokaiTheme,
    "Nord": nordTheme,
    "Stack Overflow Light": stackoverflowLightTheme,
    "Tokyo Night Dark": tokyoNightDarkTheme,
}).map(([name, css]) => [name, editorCodeTheme(css)]));
const lowlight = createLowlight(commonLanguages);

// Code block syntax highlighting. Like Tiptap's CodeBlockLowlight, but re-colours every code
// block whose text or language changes (upstream skips changes made while the cursor is
// outside code, e.g. Replace all) and only those: other blocks keep their decorations, so
// typing elsewhere costs almost nothing. Results are cached by language and text for
// collaboration, which replaces the whole document. Blocks without a language are
// auto-detected up to AUTO_DETECT_MAX characters (detection runs every language); larger
// ones, and blocks in a language lowlight doesn't know, stay plain.
const AUTO_DETECT_MAX = 2000;
const HIGHLIGHT_CACHE_BUDGET = 2000000;  // roughly characters: text plus 32 per token
const highlightCache = new Map();
let highlightCacheSize = 0;

function highlightTokens(language, text) {
    const key = (language || "") + "\u0000" + text;
    const cached = highlightCache.get(key);
    if (cached) {
        highlightCache.delete(key);
        highlightCache.set(key, cached);
        return cached.tokens;
    }
    let tree = null;
    if (language) {
        if (lowlight.registered(language)) tree = lowlight.highlight(language, text);
    } else if (text.length <= AUTO_DETECT_MAX) tree = lowlight.highlightAuto(text);
    const tokens = [];
    const walk = (nodes, classes) => {
        for (const node of nodes) {
            const own = [...classes, ...(node.properties?.className || [])];
            if (node.children) walk(node.children, own);
            else tokens.push([node.value.length, own.join(" ")]);
        }
    };
    if (tree) walk(tree.children || [], []);
    const size = key.length + tokens.length * 32;
    if (size <= HIGHLIGHT_CACHE_BUDGET / 4) {
        highlightCache.set(key, { tokens, size });
        highlightCacheSize += size;
        for (const [oldKey, entry] of highlightCache) {
            if (highlightCacheSize <= HIGHLIGHT_CACHE_BUDGET) break;
            highlightCache.delete(oldKey);
            highlightCacheSize -= entry.size;
        }
    }
    return tokens;
}

function blockDecorations(node, pos, defaultLanguage) {
    const decorations = [];
    let from = pos + 1;
    for (const [length, className] of highlightTokens(node.attrs.language || defaultLanguage, node.textContent)) {
        if (className) decorations.push(Decoration.inline(from, from + length, { class: className }));
        from += length;
    }
    return decorations;
}

function forEachCodeBlock(doc, name, callback) {
    doc.descendants((node, pos) => {
        if (node.type.name !== name) return true;
        callback(node, pos);
        return false;
    });
}

const codeHighlightKey = new PluginKey("codeHighlight");
const CodeBlockHighlight = CodeBlock.extend({
    addProseMirrorPlugins() {
        const name = this.name;
        const defaultLanguage = this.options.defaultLanguage;
        return [
            ...(this.parent?.() || []),
            new Plugin({
                key: codeHighlightKey,
                state: {
                    init: (_, { doc }) => {
                        const decorations = [];
                        forEachCodeBlock(doc, name, (node, pos) => decorations.push(...blockDecorations(node, pos, defaultLanguage)));
                        return DecorationSet.create(doc, decorations);
                    },
                    apply: (tr, set, oldState) => {
                        if (!tr.docChanged) return set;
                        // A block needs new colours if it is a new node (text or language
                        // changed) or sits in a changed range (moved in unchanged).
                        const oldBlocks = new Set();
                        forEachCodeBlock(oldState.doc, name, (node) => oldBlocks.add(node));
                        const changed = [];
                        tr.mapping.maps.forEach((map, i) => {
                            const rest = tr.mapping.slice(i + 1);
                            map.forEach((_from, _to, start, end) => changed.push([rest.map(start, -1), rest.map(end, 1)]));
                        });
                        set = set.map(tr.mapping, tr.doc);
                        forEachCodeBlock(tr.doc, name, (node, pos) => {
                            const end = pos + node.nodeSize;
                            if (oldBlocks.has(node) && !changed.some(([from, to]) => from <= end && to >= pos)) return;
                            set = set.remove(set.find(pos + 1, end - 1)).add(tr.doc, blockDecorations(node, pos, defaultLanguage));
                        });
                        return set;
                    },
                },
                props: { decorations: (state) => codeHighlightKey.getState(state) },
            }),
        ];
    },
});

// Export everything to window.tiptap object
window.tiptap = {
    // Core
    Editor,
    Node,
    Extension,
    mergeAttributes,
    generateHTML,
    Plugin,
    PluginKey,
    Decoration,
    DecorationSet,
    ySyncPluginKey,
    absolutePositionToRelativePosition,
    relativePositionToAbsolutePosition,

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
    lowlight,
    codeThemes,
    CodeBlockHighlight,
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
    Emoji,
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
    TableOfContents,
    FindAndReplace,
    ServerAiToolkit,
    getEditorContext,
    createAutobindingSaveController,

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
    InlineMath,
    BlockMath,
    loadKatex,
    whenKatexLoaded,

    // Collaboration
    Collaboration,
    isChangeOrigin,
    CollaborationCaret,
    yCursorPlugin,
    HocuspocusProvider,
    Y,
    createClient,
    LiveblocksProvider,

    // Third-party
    tippy,
};

// Export CollaborationCaret as tiptapCollaborationCaret for backward compatibility
// window.tiptapCollaborationCaret = CollaborationCaret;
