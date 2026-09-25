# WTF-262: typing at a link's edges

## Problem

Tiptap's Link mark is *inclusive* whenever **Autolink** is on, and the plugin
turns Autolink on by default. With an inclusive mark, text typed at the link's
right edge joins the link. A writer who links a word from a toolbar (**Set
link**), clicks after it and keeps typing gets their sentence inside the link.
This was reproduced on the pushed development version in real Bubble run mode
(see `verification.md`).

## Supported behavior

| Case | Result |
| --- | --- |
| Caret at a link's right edge (click, arrow keys, End), then type | Plain text. Applies with Autolink on or off. |
| Link at the end of a line, then type | Plain text. |
| Caret inside a link, then type | Joins the link (editing link text still works). |
| Caret at a link's left edge, then type | Plain text (unchanged). |
| **Set link** with nothing selected, then type | The typed text is the link, until the caret moves (click, arrow keys, Enter). Then typing is plain again. |
| Select a whole link and type over it | The new text keeps the link, like the case above. |
| Paste or drop over a selected link | Pasted content keeps its own formatting; the link is not reapplied (unchanged). |
| Edits from other collaborators | Never extend or reapply a link. |
| **Set link** on a selection | Links the selection and keeps it selected. |
| **Remove link** | Removes the link; the text stays (unchanged). |
| Autolink (type a URL, then a space) | Links the URL only; the space and what follows are plain (unchanged). |
| HTML and JSON round trips (**Set content**, initial content) | Unchanged output. |

To extend an existing link to more text, select the text and use **Set link**.

## Implementation

`linkWithPlainRightEdge()` in `src/elements/tiptap-AAC/initialize.js` extends
Link with `inclusive: false` and one ProseMirror plugin. The plugin keeps
typing inside a link that the user is actively typing: after a **Set link** with
an empty selection (a stored link mark), or after typed text replaced a fully
linked selection. It re-applies the link to that typed text and keeps a stored
link mark while the caret stays at its end. The runtime bundle now exports
`Plugin` and `PluginKey` for this.

Tests: `lib/tests/link-boundary-lifecycle.mjs` (node, `npm test`) and
`lib/tests/browser/link-boundary.spec.mjs` (Chromium, Firefox, WebKit).
