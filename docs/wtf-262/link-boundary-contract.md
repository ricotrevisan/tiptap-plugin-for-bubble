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
| IME composition at a link's right edge | Plain text (Chromium browser test). |
| Caret at a link's right edge: **link** state, `isActive("link")` | No. (With Autolink on this used to be yes; a Link button lit by this state now lights only inside a link.) |
| Caret inside a link, then type | Joins the link (editing link text still works). |
| Caret at a link's left edge, then type | Plain text (unchanged). |
| **Set link** with nothing selected, then type | The typed text is the link, until the caret moves (click, arrow keys, Enter), or ArrowRight at the end of a paragraph. Then typing is plain again. From a Bubble button this needs the editor to keep focus (for example a keyboard-shortcut workflow); clicking back into the editor moves the caret. |
| **Set link** with the caret right after a link | Starts a new link for the text typed next. (It used to remove the neighboring link, because the caret counted as inside it.) |
| Backspace or an input rule inside a link being typed | The link keeps going. Deleting all of it ends it, so text typed next is plain. |
| ArrowRight at the end of a paragraph ending in a link | Moves on as usual. (With Autolink on, Tiptap used to insert a space here to leave the link; that is no longer needed.) |
| Select a whole link and type over it | The new text keeps the link, like the case above. |
| An edit reaching back before a link being typed, a mention, or several changes at once | Ends the link being typed; no extra text is linked. |
| Paste or drop over a selected link | Pasted content keeps its own formatting; the link is not reapplied (unchanged). |
| Edits from other collaborators | Never extend or reapply a link. y-tiptap marks remote changes `addToHistory: false`; the plugin ignores them (lifecycle test uses that meta, not a live collaboration session). |
| **Set link** on a selection | Links the selection and keeps it selected. |
| **Remove link** | Removes the link; the text stays (unchanged). |
| Autolink (type a URL, then a space) | Links the URL only; the space and what follows are plain (unchanged). |
| HTML and JSON round trips (**Set content**, initial content) | Unchanged output. |

To extend an existing link to more text, select the text and use **Set link**.

## Implementation

`linkWithPlainRightEdge()` in `src/elements/tiptap-AAC/initialize.js` extends
Link with `inclusive: false`, one ProseMirror plugin and an ArrowRight shortcut.
The plugin tracks a link the user is actively typing: it starts with text typed
at the caret while **Set link**'s stored link mark is active, or typed over a
fully linked selection. It continues through single text edits inside that run
(typing, Backspace, input rules). It re-applies the link to the run and keeps a
stored link mark while the caret stays at its end. Moving the caret, removing
the stored mark, paste/drop/cut, remote edits, IME composition, non-text
insertions and edits reaching before the run end it. The runtime bundle now
exports `Plugin` and `PluginKey` for this.

Tests: `lib/tests/link-boundary-lifecycle.mjs` (node, `npm test`) and
`lib/tests/browser/link-boundary.spec.mjs` (Chromium, Firefox, WebKit).
