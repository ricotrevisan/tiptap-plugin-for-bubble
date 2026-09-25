# WTF-261: Mention created event contract

Bubble developers want to start a workflow when a user mentions someone, for
example to notify that person. The event therefore means "a user picked an
item from this editor's mention suggestion list". It does not mean "a mention
node appeared in the document". This keeps copy/paste, undo/redo, loaded
content and collaborators from sending the same notification again.

## New element outputs

| Kind | Caption | Name | Type |
| --- | --- | --- | --- |
| Event | Mention created | `mention_created` | — |
| State | Created mention ID | `mentioned_id` | text |
| State | Created mention label | `mentioned_label` | text |
| State | Created mention trigger character | `mentioned_trigger_char` | text |

## Contract

1. **Local suggestion acceptance fires once.** When the user accepts a
   suggestion with Enter, Tab or a click, and the mention is inserted, the
   element publishes the three states, then fires **Mention created** exactly
   once. The check runs after either insertion path in the suggestion list:
   the plugin's own insertion, and Tiptap's default mention command, which the
   list falls back to when it has no range yet.
2. **States are set before the event.** A workflow on **Mention created** reads
   the new mention from the three states:
   - ID: the item's configured ID field, as text (`String(id)`).
   - Label: the item's configured label field, as text.
   - Trigger character: the **Mention trigger character** the editor was built
     with (default `@`).
3. **The states keep the latest created mention.** They start empty when the
   element loads. They change only when the next mention is created. They are
   not cleared by edits, deleting that mention, undo, Set content, rebuilds or
   teardown, so a workflow step that runs later still reads the values the
   event announced.
4. **No event without an insertion.** If the selected suggestion has no item
   (empty list) or the insertion does not change the document, nothing is
   published and the event does not fire.
5. **These do not fire:**
   - **Paste and drop**, including mentions copied from this or another editor.
   - **Undo and redo**, including redo of a mention insertion.
   - **Initial content**, **Set content**, **Clear contents**, autobinding loads,
     record switches, resets and rebuilds.
   - **Programmatic insertion** (for example the Tiptap `insertContent` command).
     Only the suggestion list fires the event.
   - **Remote collaboration changes.** A collaborator who picks a suggestion
     fires the event only in their own browser; other editors receive the
     change through Yjs and do not fire.
   - Moving a mention (cut and paste, or drag and drop).
6. **Multiple editors are independent.** Each element publishes only its own
   states and events. Accepting a suggestion in one editor never fires another
   editor's event.
7. **Mention JSON is unchanged.** The mention node keeps its existing
   `{ id, label, mentionSuggestionChar }` attributes and HTML output.
8. **Each acceptance is separate.** Mentioning the same person twice fires
   twice. Notification workflows that must not repeat should deduplicate in
   Bubble (for example "only when this person is not already notified for this
   document").

## Simple Bubble workflow

1. Enable **Mention** on the Tiptap element and set its list, label and ID
   fields.
2. Add the workflow **When Tiptap Mention created**.
3. In its actions, use **Tiptap's Created mention ID** (for example to find the
   User to notify) and **Tiptap's Created mention label** (for example in the
   message text).

No custom JavaScript or Content (JSON) diffing is needed.

## Test coverage

`lib/tests/mention-created-lifecycle.mjs` (node, real decoded source and
`lib/dist.js`) covers items 1–8. `lib/tests/browser/lifecycle.spec.mjs` covers
item 1 with a real keyboard Enter and a real click in three browser engines.
