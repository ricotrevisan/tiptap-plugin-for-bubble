# WTF-261 verification

## Git and plugin
- PR [#47](https://github.com/ricotrevisan/tiptap-plugin-for-bubble/pull/47) was squash-merged as `f7a1aa7` at 2026-09-25T10:44:31Z. Its tree is identical to the reviewed head `51b6d37`.
- `pled push` was run from that tree on 2026-09-25, with owner approval. It reported "Plugin uploaded successfully"; afterwards `pled status` reported **In sync**. `.src.json` in this commit is the pushed baseline.
- No runtime bundle release was needed: `lib/index.js` and the dependencies are unchanged.

## Bubble demo
- App `tiptap-plugin`. Dedicated branch `wtf-261-mention` (`73kna`), created from `test`.
- Savepoint `1790333225423` was created before `buildprint apply`, which applied 12 changes to `73kna`.
- Reusable `demo-mentions` on page `tiptap-demo` has these additions:
  - Custom states `last mention` (text) and `mention count` (number).
  - Workflow **Log created mention**: *When Mentions editor Mention created* → set `last mention` to `Created mention label (ID Created mention ID, typed with Created mention trigger character)`, and set `mention count` to count + 1.
  - A readout box, and one wiring step plus a sentence explaining which changes do not fire.
- The existing editor keeps **File uploads enabled = no** (`file_upload_condition: false`).

## Real-preview check
URL: https://tippy:tappy@tiptap-plugin.bubbleapps.io/version-73kna/tiptap-demo

| Step | Result |
| --- | --- |
| Page load with initial content | Mention created fired: 0 times; Last mention empty |
| Real keys: space, `@`, `C`, `a`; popup shows Captain Apollo; Enter | 1 times; `Captain Apollo (ID 1714943296349x632152051130220800, typed with @)` |
| Ctrl+Z twice | Still 1. This editor has no History extension, so nothing was undone. Undo/redo is covered by the node and browser tests. |
| Ctrl+A, Ctrl+C, Ctrl+V | Still 1. The automated browser has no clipboard, so nothing was pasted. Paste is covered by the node test. |
| Real keys: space, `@`, `L`, `i`; clicked **Lieutenant Starbuck** in the popup | 2 times; `Lieutenant Starbuck (ID 1715009827040x221950535026551170, typed with @)` |

Screenshot: `demo-mention-created.png`.

## Not done
The Bubble branch has not been merged into `test` or `live`, and there has been no Marketplace release. Both need separate owner approval.
