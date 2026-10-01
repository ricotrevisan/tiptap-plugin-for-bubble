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
