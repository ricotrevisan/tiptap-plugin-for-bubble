# Changelog

All notable changes to the Rich Text Editor (Tiptap.dev) Bubble plugin will be documented in this file.

---

## Unreleased

### Dedicated Table of Contents element (#8)

- Added **Tiptap Table of Contents**, a dependency-free visual element that consumes the editor's live Table of contents JSON state.
- Renders semantic nested navigation, preserves focus during active-heading updates, and styles active/scrolled-over headings.
- Supports automatic heading scrolling plus a Clicked heading ID state and Heading clicked event for custom workflows.
- Handles empty and invalid JSON without leaving stale navigation visible.

---

## v4.8.0

### Line height & background color (#10)

- Added **Line Height** and **Background Color** support, closing the formatting-parity gap next to the existing text color and font controls.
- New element toggles: **Line Height** (`ext_lineheight`) and **Background Color** (`ext_backgroundcolor`), both off by default.
- New workflow actions: **Set line height** / **Unset line height** and **Set background color** / **Unset background color**.
- New states: **Line height** and **Background color**, mirroring the existing `color` / `font_size` / `font_family` states.
- Both features apply as inline styles on the text-style mark and round-trip correctly through HTML and JSON. No new dependency — they're sub-exports of `@tiptap/extension-text-style`, already bundled.

---

## v4.7.2

### AI Toolkit editor context (#6)

- Added the **AI editor context (JSON)** state. When **AI Toolkit** is enabled, it contains the `editorContext` generated from that editor's actual extension configuration for use with Tiptap's server-side AI Toolkit API.
- The state stays empty while AI Toolkit is disabled and is cleared during editor teardown or schema rebuilds.
- Toggling AI Toolkit rebuilds the editor schema without discarding the current unsaved local document.
- This release exposes the required editor context only. It does not call Tiptap's API, sign JWTs, execute AI tools, or include an AI-provider integration. Tiptap's server-side AI Toolkit requires a compatible paid Tiptap account.

---

## v4.7.1

### ✨ AI Toolkit extension (#3)

Added support for Tiptap's AI Toolkit (`@tiptap/ai-toolkit` v0.3.0), enabling server-side AI editing via `api.tiptap.dev/v4/ai/toolkit/*`.

- **New "AI Toolkit" checkbox** on the element (off by default). When enabled, the `ServerAiToolkit` extension is registered, so the block-targeting attributes used by Tiptap's server-side AI API survive local editing — previously they were wiped as soon as someone typed.
- Included with Tiptap's approval; the server-side API requires a paid Tiptap account.

---

## v4.6.1

### Bug Fix — Image resize not persisting

Fixed a bug where resizing an image would not persist after page refresh. The resized image would revert to its original size when the page was reloaded.

**Root cause:** The `tiptap-extension-resizable` extension was directly mutating the ProseMirror node's `attrs.width` property instead of dispatching a proper transaction. ProseMirror uses immutable data structures, so direct mutations are not recorded in the document state and `editor.getHTML()` would not include the resized width.

**Fix:** The extension now uses `editor.chain().updateAttributes('image', { width })` on mouseup to properly persist the width change via a ProseMirror transaction.

**Note:** The `tiptap-extension-resizable` npm package has been vendored to `lib/vendor/tiptap-extension-resizable.js` to preserve the fix across `npm install`.

---

## v4.6.0

### ✨ Editor Rebuild on Document ID Change

When the collaborative document ID (`collab_doc_id`) changes at runtime, the editor now automatically tears down and rebuilds with a new provider connected to the new document. Previously, changing the document ID required a page reload.

- **Automatic teardown & rebuild** — When `collab_doc_id` changes while the editor is active in collaboration mode, the existing provider and editor are cleanly destroyed (connections closed, timers cleared, DOM removed) and a fresh editor is created for the new document.
- **New event: `Collaboration document changed`** — Fires just before the teardown begins, allowing workflows to react to the document switch (e.g., save state, show a loading indicator).
- **Shared teardown function** — Introduced a reusable `teardownEditor()` helper that handles full cleanup: collab sync polling, retry timers, debounce timeouts, provider destruction, editor destruction, DOM removal, and state reset. Used by document ID change detection, collab auth failure retries, and element reset — eliminating duplicated teardown logic.
- **Improved reset cleanup** — `reset.js` now uses the shared teardown for complete resource cleanup instead of only clearing timers.

### 🔧 Minor Improvements

- **App ID → Doc Server ID** — The `app_id` collaboration field has been renamed to match Tiptap's current naming: **Doc Server ID**.
- **Collab status values in inspector** — The possible `collab_status` values (`disconnected → connecting → connected → synced`) are now documented directly in the plugin property panel for easy reference.

---

## v4.5.0

### 🐛 Bug Fix — Table selection

Fixed an issue where selecting text inside a table cell with the mouse could cause the entire table to appear highlighted instead of just the text within the cell. This happened because `prosemirror-tables` converts accidental table-level selections into a cell selection covering all cells. A new **Allow table node selection** option lets users control this behavior.

### ✨ New Table Options

Four new configuration options for the Table extension:

- **Resizable columns** (checkbox, default on) — Controls whether table columns can be resized by dragging column borders. Previously hardcoded to `true`. Disable for simpler tables with equal-width columns and no resize handles.
- **Allow table node selection** (checkbox, default off) — Controls what happens when the table itself is selected (e.g. by clicking near its border). When off (default, previous behavior), the selection is converted to a cell selection covering all cells — which can cause the entire table to appear highlighted. When on, the table is selected as a single block, which is less disruptive and easier to dismiss.
- **Last column resizable** (checkbox, default on) — Whether the rightmost column of the table can be resized. Disabling this prevents unexpected table expansion when dragging the last column border.
- **Resize handle width** (number, default 5) — Width in pixels of the invisible resize handle zone on column borders. A larger value makes resizing easier to trigger; a smaller value reduces accidental resize activation near cell edges.

---


### ✨ New Server-Side Action

- **Convert webhook payload to HTML** — Converts Hocuspocus / Tiptap Cloud webhook payloads into clean HTML for storage in the database. When collaboration is active, the document lives on the collab server as a Y.js document and webhooks deliver changes as ProseMirror JSON — not HTML. This action bridges that gap.
  - **Smart format detection** — Accepts three input formats automatically:
    1. Full Hocuspocus webhook body (auto-extracts `payload.document`)
    2. Document object with named fields (e.g. `{ "default": { "type": "doc", ... } }`)
    3. Raw ProseMirror JSON (e.g. `{ "type": "doc", "content": [...] }`)
  - **Field name** parameter (optional, default: `"default"`) — for custom Hocuspocus setups using a different Y.js field name
  - Returns: `html` (text), `error` (text), `returned_an_error` (boolean)
  - Supports all editor node/mark types: headings, bold, italic, underline, strike, code, blockquotes, lists, task lists, tables, images, YouTube embeds, links, highlights, text color, font family, font size, subscript, superscript, details/accordion, mentions, and horizontal rules

---

## v4.4.0

### ✨ New Extensions

- **Drag Handle** — Adds a draggable grip icon to the left of blocks (paragraphs, headings, lists, tables, etc.) on hover. Users can click and drag to reorder content visually. Includes:
  - Extension toggle: **Drag Handle** (checkbox, default off)
  - **Nested drag** (checkbox, default off) — when enabled, the drag handle also targets nested content like individual list items, paragraphs inside blockquotes, etc.
  - **Drag handle CSS override** — inject custom CSS for the handle element (class: `.tiptap-drag-handle`)

---

## v4.3.0

### ✨ New Extensions

- **Details / Accordion** — Collapsible `<details>/<summary>` blocks for FAQs, toggleable sections, and accordion-style content. Includes:
  - Extension toggle: **Details / Accordion** (checkbox, default off)
  - **Persist open state** (checkbox, default off) — preserves open/closed state in the document
  - CSS overrides: **Details CSS override** (details container) and **Details summary CSS override** (summary element)
  - New action: **Toggle Details** — wraps/unwraps current selection in a details block
  - New exposed state: **selection is details** (boolean) — whether cursor is inside a details block

- **Invisible Characters** — Shows paragraph marks (¶), spaces (·), and hard breaks for power users who need to see whitespace. Includes:
  - Extension toggle: **Invisible Characters** (checkbox, default off)
  - **Start visible** (checkbox, default on)
  - **Invisible characters CSS override** for character decorations
  - New action: **Toggle Invisible Characters** — toggles visibility on/off
  - New exposed state: **Invisible characters visible** (boolean)

### 🔧 Bug Fixes

- Fixed duplicate field names that could cause encoding issues

---

## v4.2.0

### ✨ New Options on Existing Extensions

- **CodeBlock: Tab indentation** — New checkbox to allow the Tab key to indent inside code blocks instead of moving focus. Includes a configurable **Tab size** (default: 4 spaces).
- **Link: Additional protocols** — New text field to specify additional protocols to recognize as valid links (e.g. `tel`, `mailto`, `ftp`). Comma-separated.
- **YouTube: Default width & height** — New number fields to set the default pixel dimensions for embedded YouTube videos (defaults: 640×480).
- **Mention: Trigger character** — New text field to change the character that triggers the mention popup (default: `@`). Use `#` for hashtags, etc.
- **Image: Inline images** — New checkbox to make images flow inline with text instead of being block-level elements.
- **Table: Cell min width** — New number field to set the minimum column width in pixels when resizing tables (default: 25px).

### 🎨 New CSS Override Fields

- **Horizontal rule CSS override** — Inject custom CSS for `<hr>` elements.
- **Inline code CSS override** — Inject custom CSS for inline `<code>` elements (does not affect code inside code blocks).
- **Code block CSS override** — Inject custom CSS for code block (`<pre>`) elements.
- **Subscript CSS override** — Inject custom CSS for `<sub>` elements.
- **Superscript CSS override** — Inject custom CSS for `<sup>` elements.
- **Task list CSS override** — Inject custom CSS for task list checkboxes.

---

## v4.1.1

### 🐛 Bug Fixes

- **Auto-binding ignored when collaboration is active**: Fixed a critical conflict when both collaboration and auto-binding were enabled simultaneously. The auto-binding system works by writing editor HTML to a Bubble database field and reading changes back via `setContent()`. However, collaboration uses a Y.js CRDT document as the source of truth, and `setContent()` replaces the entire document — destroying the Y.js state, losing remote edits, and causing content duplication or cursor jumps. When both were on, every user was continuously writing HTML to the same Bubble field (their own and remote changes), creating race conditions and feedback loops that corrupted the collaborative document. This also caused a crash — `TypeError: can't access property "name", e is undefined` — because `setContent()` corrupted the document structure and subsequent `onSelectionUpdate` events called `generateHTML` against the broken state. Now, when collaboration is active, auto-binding writes and read-backs are suppressed. The collaborative Y.js document takes priority as the single source of truth. A one-time debugger warning is shown if both are enabled. States (`contentHTML`, `contentText`, `contentJSON`) and the `contentUpdated` event continue to work normally.

### 📝 Documentation

- **"Enable collaboration?" field**: Added documentation explaining that auto-binding is automatically ignored while collaboration is active to prevent conflicts.

---

## v4.1.0

### ✨ New Extensions

- **Trailing Node** (on by default) — Automatically inserts an empty paragraph at the end of the document when the last node is a block element (table, image, code block, etc.). Prevents users from getting trapped with no way to continue typing below block-level content.
- **Focus** (off by default) — Adds a `has-focus` CSS class to the node where the cursor is currently positioned. Enables styling the active block — e.g., a subtle background or left border on the focused paragraph. Configurable mode: `deepest` (default, innermost node only), `shallowest` (outermost node only), or `all` (all ancestor nodes).
- **Selection** (off by default) — Keeps the text selection visually highlighted when the editor loses focus. Useful when users click toolbar buttons outside the editor — the selection remains visible instead of disappearing. A default blue highlight style (`.selection { background: #accef7 }`) is provided automatically. Includes a **Selection CSS override** field to customize the highlight styling.

### 🤝 Collaboration

- **New field: Cursor label CSS override** — Inject custom CSS for the collaboration cursor label (the floating name tag above each user's cursor). Customize font-size, padding, opacity, etc.

#### How the collaboration cursor works

Each collaborator's cursor renders two elements:

1. **The caret** (`.collaboration-carets__caret`) — a thin vertical line at the cursor position, colored with `border-color` from the user's `cursor_color`.
2. **The name label** (`.collaboration-carets__label`) — a floating tag above the caret showing the user's name, with `background-color` set to the user's `cursor_color`.

The plugin provides sensible defaults (12px font, 600 weight, rounded corners, positioned above the caret). To customize, use the **Cursor label CSS override** field. Any CSS you add is injected into the `.collaboration-carets__label` rule and overrides the defaults.

**Default label styles:**
```css
.collaboration-carets__label {
    position: absolute;
    top: -1.4em;
    left: -1px;
    font-size: 12px;
    font-style: normal;
    font-weight: 600;
    line-height: normal;
    user-select: none;
    color: #0D0D0D;
    padding: 0.1rem 0.3rem;
    border-radius: 3px 3px 3px 0;
    white-space: nowrap;
    /* background-color is set inline from cursor_color */
}
```

**Example overrides:**
- Larger label: `font-size: 14px; padding: 0.2rem 0.5rem;`
- Semi-transparent: `opacity: 0.7;`
- White text on colored background: `color: #fff;`
- Different shape: `border-radius: 8px;`

### 🐛 Bug Fixes

- **Collaboration cursor styles not applied**: Fixed CSS class name mismatch from the v3 upgrade — the stylesheet targeted `.collaboration-cursor__caret` / `.collaboration-cursor__label` but Tiptap v3's `CollaborationCaret` extension renders with `.collaboration-carets__caret` / `.collaboration-carets__label`. The floating name label now displays correctly with proper positioning, styling, and background color.

---

## v4.0.0

### ⚡ Tiptap v3 Upgrade

The entire plugin has been upgraded from Tiptap v2 to **Tiptap v3** (`@tiptap/core ^3.0.9` and all extensions). This is a major upgrade that brings performance improvements, new APIs, and better extensibility.

- **Tiptap v3 core and all extensions** updated to `^3.0.9`
- **Hocuspocus provider** updated from `^3.2.2` to `^3.4.4`
- **BubbleMenu / FloatingMenu** now use Floating UI (Tiptap v3) instead of tippy.js — menus are now explicitly hidden before being passed to the extension to prevent flash-of-unstyled-content
- **History → UndoRedo**: Replaced the `History` extension with Tiptap v3's `UndoRedo` extension (History is automatically disabled when collaboration is active)
- **TableKit → Individual table extensions**: Replaced the bundled `TableKit` with individual `Table`, `TableRow`, `TableHeader`, and `TableCell` extensions for finer control
- **CollaborationCursor → CollaborationCaret**: Updated to Tiptap v3's renamed collaboration cursor extension

### 🏗️ Architecture Refactor

Major refactoring of the plugin's internal architecture for better maintainability, reliability, and performance.

#### Library management overhaul
- **Consolidated `window.tiptap` namespace**: All libraries are now exported as a single organized `window.tiptap` object instead of scattered `window.tiptapXyz` globals. The object is structured by category (Core, Basic nodes, Formatting, Block elements, Lists, Advanced, Styling, Interaction, Utilities, Collaboration, Third-party)
- **New extensions exported**: `UndoRedo`, `TrailingNode`, `Focus`, `Selection` now available from `@tiptap/extensions`

#### Code reorganization
- **Editor setup moved to `initialize.js`**: The ~760-line editor creation logic that previously lived in `update.js` has been moved to `initialize.js` as `instance.data.setupEditor()`. `update.js` is now a lean ~110-line file that handles property changes only
- **Stylesheet logic extracted**: CSS generation is now a reusable `instance.data.applyStylesheet(properties)` function callable from both `update.js` and the collab retry path, eliminating duplication

#### Script loading
- **Moved from `shared.html` to `headers.html`**: All scripts (dist.js, lodash, tippy.js styles) moved from the plugin-level `shared.html` to the element-level `headers.html` with `defer` attributes for better loading performance
- **`shared.html` cleared**: No longer loads any scripts at the plugin level

### 🤝 Collaboration Improvements

Substantial improvements to the real-time collaboration system across all three providers (Tiptap Cloud, Custom Hocuspocus, Liveblocks).

- **Auth failure retry with exponential backoff**: When collaboration authentication fails (e.g., JWT not yet valid on the server), the plugin now automatically retries up to 5 times with exponential backoff delays (1s, 2s, 4s, 8s, 16s). The editor and provider are torn down and re-created on each retry
- **Initial content for empty collab documents**: New `maybeSetCollabInitialContent()` helper handles the race condition between provider sync and editor creation — initial content is set on whichever fires last
- **Collab sync polling fallback**: Added an interval-based polling fallback for detecting sync completion, since `onSynced` may not fire reliably in all providers
- **Graceful JWT waiting**: When collaboration is enabled but the JWT token isn't ready yet, the editor now waits gracefully instead of erroring. A one-time debug warning is shown

#### New collaboration exposed states
- **`collab_status`** (text) — current connection status (e.g., "connected", "disconnected")
- **`collab_synced`** (boolean) — whether the document has synced with the server
- **`collab_connected_users`** (number) — count of connected collaboration users
- **`collab_status_changed`** (event) — fires when the collaboration status changes
- **`collab_synced`** (event) — fires when the document syncs

### 🔐 Auth Token Action Rewrite

The server-side JWT action has been completely rewritten and renamed.

- **Renamed**: "Generate JWT Key" → **"Generate Auth Token"**
- **New fields**:
  - `Document names (comma-separated)` — replaces the old `Doc ID` + `Doc ID (list)` fields. Now accepts a comma-separated string of allowed document names
  - `App ID` — included as the `aud` (audience) claim in the token for security
  - `User ID (sub)` — included as the `sub` (subject) claim for traceability and auditing
  - `Expiration (seconds)` — configurable token lifetime (default: 86400 / 1 day). Previous version had no expiration
- **Plugin secret keys renamed**: "Tiptap Cloud JWT secret" → "Tiptap Cloud document server secret", "Custom collab JWT secret" → "Custom collab document server secret"
- **Improved error handling**: Secret keys are now trimmed before use; error messages are more descriptive

### ✨ New Features

- **New action: Unset All Marks** — removes all formatting marks (bold, italic, etc.) from the current selection
- **New exposed state: `is_empty`** (boolean) — reflects whether the editor content is empty, updated on every transaction
- **New exposed state: `can_undo`** (boolean) — whether an undo operation is available
- **New exposed state: `can_redo`** (boolean) — whether a redo operation is available
- **New field: Debug Mode** — toggleable debug logging. When enabled, logs detailed `[Tiptap]` messages to the console. When disabled, no console output is produced (replaces scattered `console.log` calls)

### 🐛 Bug Fixes

- **Cursor position preservation**: When content is updated programmatically (via autobinding or initialContent change), the cursor position is now saved and restored (clamped to document bounds) instead of jumping to the start
- **Menu elements not found on time**: Fixed a race condition where bubble menu and floating menu elements weren't detected during initialization
- **`getSelection` fixed**: The `selectedHTML` state now uses `generateHTML` from the `window.tiptap` namespace with the editor's actual extensions, producing correct HTML output
- **CSS loading condition**: Fixed a condition where editor styles weren't applied correctly
- **Debounce timeout cleared on programmatic updates**: Prevents stale debounced writes from overwriting programmatic content changes

### 🔧 Extensions Refactor

The old error-prone comma-separated list of extension names has been replaced with individual yes/no toggles for each extension. Each toggle is organized into its own labeled section, making extensions easy to discover, toggle on/off, and control dynamically with Bubble expressions.

- **29 individual yes/no toggles** replace the old text field where you had to type exact extension names
- **Organized into sections** — Text Formatting, Highlight, Heading (with H1–H6 styling), Blockquote, Structure, Lists, Image, YouTube, Link, Table, Menus, Editor Behavior, Hard Break, Mention, Unique ID, Preserve Attributes
- **Extensions with settings** have their related options grouped directly below the toggle (e.g., Table toggle + cell padding, border colors; Link toggle + link colors/CSS; Heading toggle + heading levels + H1–H6 styling)
- **Every toggle has documentation** explaining what the extension does, how to use it, and relevant keyboard/markdown shortcuts

### 🎨 CSS Override Fields Cleanup

All advanced CSS override fields have been renamed, documented, and converted from large textareas to compact single-line inputs.

| Before | After |
|--------|-------|
| `h1_adv` – `h6_adv` | **H1 CSS override** – **H6 CSS override** |
| `p_adv` | **Paragraph CSS override** |
| `Image properties` | **Image CSS override** |
| `YouTube` (duplicate name) | **YouTube CSS override** |
| `Blockquote styling` | **Blockquote CSS override** |
| `Highlight CSS` | **Highlight CSS override** |
| `Bullet lists CSS` / `Number list CSS` | **Bullet list CSS override** / **Ordered list CSS override** |
| `link_adv`, `link_unvisited_adv`, etc. | **Link CSS override**, **Unvisited link CSS override**, etc. |
| `CSS for base div // override` | **Base div CSS override** |

All CSS override fields now use compact inputs (use `arbitrary text` for more room), and have documentation explaining that they inject raw CSS that overrides the preceding settings (size, color, weight, etc.).

### 📝 Preserve Attributes Fields Renamed

| Before | After |
|--------|-------|
| `preserve_attributes` | **Preserve HTML attributes** |
| `preserved_attributes` | **Preserved attributes (read-only)** |
| `preserve_unknown_ta...` (truncated) | **Preserve unknown HTML tags** |

All three fields now have documentation explaining what they do and how they relate to each other.

### 🗂️ Property Panel Reorganization

The entire property panel has been reorganized into a clean hierarchy: General config → Stylesheet → Extensions (with toggles + related settings) → Collaboration → Debug mode.

### 🧹 Cleanup

- **Proper reset handling**: `reset.js` now cleans up collab retry timers and sync polling intervals instead of just logging
- **All element actions** updated with consistent editor-ready guards (`returnAndReportErrorIfEditorNotReady`)
- **Console logging gated**: All `console.log` calls replaced with the `instance.data.debug()` helper, controlled by the Debug Mode field
