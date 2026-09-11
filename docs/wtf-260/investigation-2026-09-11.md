# Follow-up: saves finish out of order

**Historical investigation at `c3ed01e`, before the replacement save controller.** This records why the first patch was rejected. See [the current implementation and verification](README.md) for the subsequent replacement. The previous implementation protected the visible editor from known stale echoes but did not ensure that the database retained the newest submitted value.

## Recording and reproduction

The attached 88.91-second recording was analyzed using Gemini compact full-duration input, including audio, at 10 fps (maximum 1280×720; source 1274×658). Around 00:09–00:23, Stored HTML lags behind the editor and another keystroke makes it catch up. Around 00:59–01:18, the user reports missed updates and browser load while the displayed editor and Stored HTML differ. The recording does not by itself distinguish a stale display from a stale database value.

The new real-browser reproduction makes that distinction. With Update delay 0, a short burst of real keyboard events followed by six seconds of inactivity leaves the editor intact and the bound value shorter. A minimal run retained 198 HTML characters in the editor but only 167 in Bubble. A subsequent development database read confirmed the server matched the shorter bound value. This is persistent lost saving, not ordinary debounce latency.

Run on the configured/authenticated `wtf260` browser session:

```sh
python3 lib/tests/browser/reproduce-autobinding-convergence.py
```

At the investigated commit, this intentionally failing manual regression exercised the exact branch below. The script has since been updated to assert database convergence and reload preservation against the replacement controller. It saves the pre-test editor state and failure detail under `/tmp`, appends to disposable Record A, and leaves the editor open on failure. Network timing varies, so it repeats up to five rounds. Two initial runs and the instrumented minimized run failed without any artificial network delay.

## Ranked hypotheses and results

1. Bubble drops calls while a previous save is running — not supported by the trace: all three publications issued requests and returned HTTP 200.
2. Writes complete out of order — supported: requests started within roughly 107 ms, completed **2 → 3 → 1**, and the resulting bound value equalled the oldest publication.
3. The plugin misses the final editor update — ruled out for this reproduction: the last publication exactly matched the final editor HTML, and no debounce remained pending.

`save-ordering-trace.json` contains timestamps, lengths, and equality checks without record text or authentication data. In that run, the final editor contained 239 characters, but the bound value contained 205. The earlier fix ignored that stale value when rendering, which hid the persistence failure from its editor-only assertions.

## What Bubble's own Rich Text Editor does

Primary reference: [Bubble Rich Text Editor](https://bubble.io/plugin/rich-text-editor-1580238841425x582072028873097200), [public plugin editor](https://bubble.io/plugin_editor?id=1580238841425x582072028873097200).

Its public plugin source was retrieved read-only through Pled on 2026-09-11, in a separate reference workspace at `/home/rico/bubble-workspaces/reference-bubble-rich-text-editor`. The dev app's installed reference metadata says version 2.0.10; the public source endpoint does not identify a published version, so this investigation does not assert a byte-for-byte match to that release.

Relevant source under `src/elements/rich-text-input-AAC/`:

| Behavior | Source |
| --- | --- |
| Fixed 2200 ms typing interval | `initialize.js:6` |
| Mark dirty and restart a trailing timer after an edit | `update.js:479–497` |
| Read current Quill content when saving, then compare with current published content | `update.js:433–446` |
| Publish only changed content; set the remembered autobound property before publication | `update.js:451–469` |
| Distinguish programmatic loads from user changes to avoid save loops | `update.js:871–877` |
| Flush dirty content on blur and cancel the typing timer | `update.js:826–834` |

It does not implement an acknowledged save queue in those handlers. It reduces overlapping writes by waiting until typing has stopped. It uses BBCode conversion around Quill; that representation is separate from the save-ordering issue.

The Bubble runtime loaded by this fixture also confirms that `publishAutobinding` invokes `run_auto_binding`; `do_auto_binding` updates the client cache before sending `/elasticsearch/modify`, then applies server updates when responses arrive. Consequently, observing the bound property equal the submitted text is **not** proof of server acknowledgement. The return path uses `run_once` for resolving input data; it must not be assumed to be a supported server-save acknowledgement API. Reference runtime asset: `https://tiptap-plugin.bubbleapps.io/package/run_js/bf65b329236ffe1e4da17580caaaa9432f5595fc980b33bba5c2fc2038d93776/xfalse/x33/run.js`.

## Controlled comparison

A temporary browser-only wrapper changed the trailing save interval to 2200 ms. It was not pushed to the plugin or applied to the Bubble app.

- Five ordinary typing rounds passed, with one actual save per round and matching final editor/bound values.
- To test the limit, the first modify request was deliberately held for five seconds before dispatch. A second edit was made after the first debounce had fired. The newer request saved first; the older request saved afterward. Even with 2200 ms debounce, the final bound value lost the newer 19 characters (786 editor versus 767 stored).

The standalone fault-injection probe is `python3 lib/tests/browser/probe-autobinding-delayed-write.py`. Its current version retains only the network delay and verifies the replacement controller; it no longer patches the save interval. It reloads the preview after success to remove its temporary wrappers. It is a manual integration test, not production code or a CI test.

This fault injection changes request dispatch timing only. It demonstrates why increasing the timer is a useful mitigation but not an ordering guarantee. It is not a claim that the same injected latency occurred in the user's recording.

## Recommended redesign

1. Separate the responsive editor states/Content updated event from persistence timing. A delay of zero for UI updates should not imply a database write for every edit.
2. Coalesce pending edits into the latest document and save after a quiet interval, reading the current editor content at dispatch. Flush the dirty value on a normal blur, as Bubble's reference does.
3. Address ordering explicitly. A queue can wait only for an actual save completion signal; an optimistic bound-value echo is insufficient. A record-scoped workflow/adapter with completion or server-side revision enforcement can provide this contract. If native autobinding is retained, a trailing reconciliation of stale own-save responses must be designed and proven against the delayed-request regression, including record changes and legitimate external edits. A larger debounce alone is insufficient.
4. Retain record/generation isolation, but evaluate whether canceling a final pending edit on navigation meets the product requirement. Correct record association and final-edit preservation should be tested separately.
5. Require final database equality after quiescence and reload, alongside editor/selection assertions. Repeat typing during an outstanding write, out-of-order dispatch/completion, blur, A/B switching, and hide/recreate.

At the end of this investigation, no new runtime algorithm had been shipped. The PR's original 15 tests described its earlier scope and could not establish that this newly reproduced failure was resolved. The subsequent replacement and expanded tests are documented in the README.

## Environment

Git: `fix/wtf-260-autobinding`, investigated at `c3ed01e`. Bubble branch: `wtf-260-autobinding` (`33jpy`). Preview: https://tiptap-plugin.bubbleapps.io/version-33jpy/wtf-260-autobinding (tippy / tappy). Plugin source remains the existing development draft. Only disposable WTF-260 test data was exercised; no marketplace publication, app test/live change, merge, or worktree removal occurred.
