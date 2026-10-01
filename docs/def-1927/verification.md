# DEF-1927 Clear Highlight — verification

Tested on dev app `tiptap-plugin`, Bubble branch `def-1927-clear-hl` (`93l0d`, nested under `rs-port` because `test` already has nine branches), plugin Testing version pushed from commit 4e603bc.

Preview: https://tiptap-plugin.bubbleapps.io/version-93l0d/def-1927-clear-highlight

The page has two editors: collaboration off, and collaboration on (Tiptap Cloud, document `def-1927-clear-highlight`). Each has Bold, Highlight and Clear Highlight buttons that run the element actions. Steps, with real clicks and keys, in each editor:

1. Select "Bold text and plain text", click **Highlight**.
2. Select "Bold text", click **Bold**.
3. Select "Bold text", click **Clear Highlight**.

| Step | Collab off and collab on, same HTML |
| --- | --- |
| After 1–2 ([before-clear.png](before-clear.png)) | `<strong><mark>Bold text</mark></strong><mark> and plain text</mark> and italic text.` |
| After 3 ([after-clear.png](after-clear.png)) | `<strong>Bold text</strong><mark> and plain text</mark> and italic text.` |

Highlight is gone from the selection, bold stays, and highlight outside the selection stays. After a page reload the collaboration editor loads the cleared version from the shared document, with status `connected`, synced `yes` ([after-reload.png](after-reload.png)).

Automated: `lib/tests/clear-highlight-action.mjs` (in `npm test`) covers the same result plus the "editor not ready" and "Highlight extension off" guards.

## Blur

The same page now also has **Blur** and **Blur in 3 s** buttons per editor, a readout of the **is focused** state, and a counter that a page workflow on the editor's **isn't focused** event increases by 1.

Clicking a `<button>` takes focus away from the editor by itself, so the plain Blur button can't prove the action works. **Blur in 3 s** schedules a custom event that runs Blur three seconds later. That way the editor can be focused again with real clicks and keys before the action runs. Steps in each editor (collab off, then collab on), plugin Testing version from commit 0a0f177:

1. Click into the editor, press Home, select four characters with Shift+→ (selection 1–5).
2. Click **Blur in 3 s**, click back into the editor and select the same four characters. The readout shows `is focused: yes`.
3. Wait 4.5 s.

| | Collab off | Collab on |
| --- | --- | --- |
| Before Blur runs | is focused yes, DOM focus in editor, selection 1–5 | same |
| After Blur runs | is focused **no**, isn't focused events **+1**, DOM focus left the editor, selection still 1–5, HTML identical | same, collab connected and synced |

Screenshots of the collab-on run: [blur-before.png](blur-before.png), [blur-after.png](blur-after.png).

When the editor is not focused, **Blur in 3 s** changes nothing: the is focused state and the event counter stay the same.

Automated: `lib/tests/blur-action.mjs` (in `npm test`) covers the focus state, the event firing once, unchanged content and selection, and the "editor not ready" guard.
