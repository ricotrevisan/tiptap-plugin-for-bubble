# nocode-to-knowcode Tiptap demo repair

Target: `nocode-to-knowcode`, development (`test`), page `tiptap`.
Preview: https://nocode-to-knowcode.bubbleapps.io/version-test/tiptap

The copied page had 38 Bubble issues: nine missing reusable definitions, three Testing plugin references, two missing style references, and 24 missing X/Y values. Its standalone toolbar workflows were absent and its page used legacy responsive mode.

Restored nine demo definitions plus two nested note definitions from `tiptap-plugin`; mapped their Tiptap elements and actions to the already installed published plugin 4.10.6. Repaired the page's plugin/style references, coordinates, responsive layout, and ten standalone toolbar workflows. Matched the mentions label to this app's `namefirst_text` field and corrected its setup text. All 13 editor definitions have explicit File uploads enabled values.

Validation: Bubble issue checker reports **0 issues / No issues found**. A fresh run-mode load renders 12 visible editor instances (the popup editor is initially hidden), two outlines with ten links each, and no deleted-reusable placeholders. Real pointer/keyboard interaction verified typing, Bold formatting (inserted text rendered inside `strong`), and the selection state readout. Outline links were clicked; active-section tracking was not separately asserted. No live deployment or plugin release was performed.

`page-before.json` is the rollback snapshot; `page-after.json` records the repaired page. Changes were applied through the authenticated Bubble editor because Buildprint does not have this app linked. Runtime error logs were not conclusively audited: the browser snapshot tool timed out on the fully expanded page.
