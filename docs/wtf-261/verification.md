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

## Release (2026-09-25)
- Bubble branch `wtf-261-mention` was merged into Main (`test`) with no conflicts. Savepoint `1790335273000` was taken first. On `version-test/tiptap-demo`, Enter on Rico gave "Mention created fired: 1 times" with Rico's ID and `@`.
- **The first Deploy to Live was blocked:** "You cannot deploy your app because there are 13 issues". `test` already had the same 13 issues before this merge.
- **Issues fixed on a second branch, `wtf-261-live-issues` (`13kns`):** savepoint `1790343850428` was taken first, and the diff is in the release evidence. It changes 17 values in 8 files:
  - bubbleex I59/I61/I63 inputs: invalid raw formats replaced with valid Bubble types. Decimal becomes `float_number`, Percent `percentage`, Address `geographic_address`, Numbers `int_number`, DateTime `datetime-local`. bubble_ex keeps frozen copies of these pages, so its tests are unaffected.
  - Three Modern Dropdown demo elements get `return_data_type: "text"`.
  - The three Tiptap test editors get **File uploads enabled = no**.
  - In `editor_reusable_v2`, the stale `AEH` condition becomes a static `collab_app_id` equal to the parameter's default. The reusable is not used on any page.
- Bubble's issue list is cached and only rechecks an element when it is opened. After each flagged element was opened, the branch showed 0 issues.
- Merged into Main (savepoint `1790344264973`): 17 non-conflicting changes, no conflicts. `test` showed 0 issues.
- **Deployed Main to Live (Web):** "Web deployment successful". `tiptap-demo` in Live loads all 10 editors and the Mention created readout. The Live mention list is empty because the Live database has no User records.
- The `wtf-261-mention` branch was deleted after the merge; it is no longer listed.
- **Marketplace:** published **v4.12.0** (minor, MIT, not obfuscated) from main, with `pled status` In sync. It includes WTF-261, WTF-250 and WTF-248. Description: "Mention created event with mention ID, label and trigger states. New Setup error state. Liveblocks reports real sync."
