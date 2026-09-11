# WTF-260: autobinding save controller

The replacement combines typing into the latest document and reconciles older responses from its own saves. The first patch only protected the visible editor; real writes could still finish out of order and leave older text in the database. The [historical investigation](investigation-2026-09-11.md) records that failure and the comparison with Bubble's own Rich Text Editor.

## Saving behavior

- **Autobinding save delay** defaults to **2200 ms** after the last edit, following the quiet interval in Bubble's reference editor. Zero is supported. The controller reads the current editor HTML when the timer fires and skips unchanged content.
- A dirty blur flushes the pending edit before blur workflows run. A clean blur does not write.
- If a known older save response arrives after newer typing, the editor and selection stay intact. Once typing has settled, the controller coalesces stale responses into a corrective write after 250 ms. An existing typing timer keeps its deadline.
- Editor states update immediately. With autobinding on, **Content updated** fires once when a changed user edit is submitted. Corrective writes do not repeat the event or associated workflows. With autobinding off, **Update delay** still controls the event and no native save is made.
- Incoming external content loads silently and cancels pending work. A schema rebuild of the same record preserves its pending save. Record replacement and teardown invalidate queued callbacks; Undo cannot restore the previous record.

Bubble publishes an optimistic client-cache value before the database request completes. Neither that value nor Content updated is a server acknowledgement. This controller provides reconciliation for observed stale own-save responses while the document remains bound; it does not serialize native requests or implement server revisions/multi-client conflict resolution. Its production implementation uses the supported `publishAutobinding` API, with no network interception or Bubble runtime patching.

## Configure SPA editors

Set **Autobinding record ID** to the same parent Thing's unique ID used by Bubble autobinding. This distinguishes records with identical HTML. An editor permanently bound to one record can leave it blank. Without the ID, only changed content that is not a known save echo can identify incoming documents.

A record switch cancels an unsent edit or repair for the previous record. If an edit must be submitted before navigation, keep that Thing bound until Content updated or flush via normal blur before replacing it. This is submission, not a guarantee that all database requests have completed. Native autobinding cannot repair a Thing that is no longer bound; apps needing confirmed saving before navigation require an explicit workflow with a completion contract.

A legitimate incoming value that differs from previous local saves replaces the editor, including while focused. Restoring exactly an earlier local save is indistinguishable from a delayed echo; use an explicit Set content workflow for intentional restores. Collaboration remains the source of truth when enabled.

## Test environment

- Git branch: `fix/wtf-260-autobinding`, PR [#37](https://github.com/ricotrevisan/tiptap-plugin-for-bubble/pull/37), based on `91d1d43`.
- Bubble app: `tiptap-plugin`; feature branch `wtf-260-autobinding` (`33jpy`), created from `test`.
- Preview: https://tiptap-plugin.bubbleapps.io/version-33jpy/wtf-260-autobinding
- Run-mode login: `tippy` / `tappy`.
- Savepoints: original fixture `1789046933075`; before replacement fixture settings `1789119197310`.
- Disposable development Docs: A `1789047006074x991054080173902500`; B `1789047009959x299667751052360450`. Titles start with `WTF-260`. Feature branches share development data; browser scripts append only to these records and back up pre-test content under `/tmp`.
- Native autobinding targets HTML (`html_text`); File uploads enabled is explicitly **no**. Mention content type is Doc; mentions and collaboration are disabled.
- Fixture defaults to Delay 2200. Delay 0/300/2200 buttons set both delay properties so the same fixture can exercise native saving and the previous event-delay cases. The user's existing toolbar/layout edits were preserved.

`fixture/` captures the BubbleScript page and workflows. `fixture-native.json` captures the actual Bubble representation, including native plugin settings. These are reference fixtures, not instructions to apply over an existing app. Create a dedicated branch and disposable records when recreating them.

## Verification

The replacement must pass both deterministic lifecycle checks and real database/reload checks. Visible editor equality alone missed the original persistence failure.

Recorded results are in [save-controller-verification.json](save-controller-verification.json): all fifteen typing rounds passed at 0/300/2200 ms, with database and reload equality; the forced delayed-write response order was 2 → 1 → 3 (the last request is the correction). Pending and in-flight navigation checks passed, including both records’ database values and reload. Stale-cache replay passed at 0/300 ms with selection preserved.

Automated validation: the full `npm test` build/lifecycle suite, **27 dedicated autobinding scenarios**, plugin validation (73 function bodies), and all 11 validator tests. Coverage includes every completion order for three submitted saves, coalescing independent of Update delay, silent corrective writes, record/external-update cancellation, identical records, blur, detach/reattach, 260 historical save snapshots, Undo, and extension rebuilds.

From `lib/`:

```sh
npm ci
npm test
npm run validate:plugin
npm run test:validator
```

For manual browser checks, open an authenticated `agent-browser` session named `wtf260` on the exact preview above. Run these sequentially from the repository root:

```sh
python3 lib/tests/browser/reproduce-autobinding-convergence.py --delay 0
python3 lib/tests/browser/reproduce-autobinding-convergence.py --delay 300
python3 lib/tests/browser/reproduce-autobinding-convergence.py --delay 2200
python3 lib/tests/browser/probe-autobinding-delayed-write.py
python3 lib/tests/browser/check-autobinding-navigation.py
python3 lib/tests/browser/probe-autobinding-inflight-navigation.py
python3 lib/tests/browser/replay-autobinding-echo.py --delay 0
python3 lib/tests/browser/replay-autobinding-echo.py --delay 300
```

The convergence script repeats five rounds of real keyboard typing at each delay. It waits for tracked requests and pending controller work to settle, reads the actual development database through Buildprint, and verifies text after a full page reload. The delayed-write probe holds the first native request for five seconds, allows a newer edit to save first, then requires a corrective request and database/reload equality. This changes network timing only, never the save algorithm.

Navigation checks observe an actual pending A edit before a delayed Bubble workflow selects B, assert that unsent A work was cancelled and B stayed unchanged, exercise hide/switch/show and reload, and verify a new B edit in the database. A separate check holds a submitted A request across navigation and verifies each record retains its own text. Stale-cache replay verifies selection and HTML, then lets the controller repair the cache/database itself and checks reload preservation.

These tests use Bubble's internal client-cache and XHR shape only for instrumentation. Production code does not. They are manual integration checks; deterministic lifecycle tests run in CI. Ordinary navigation did not organically reproduce an A-to-B database overwrite before the original patch; deterministic tests demonstrated the unsafe callback path. No marketplace-version reproduction is claimed.

## Development bundle and rollback

The new controller lives in `lib/autobinding-save-controller.js`, exported through `window.tiptap` and used by the shared plugin lifecycle. The bundle was rebuilt and uploaded as:

- Asset: `dist-wtf-260-save-controller-c545e6551107.js`
- CDN: https://meta-q.cdn.bubble.io/f1789119216104x946002472150542700/dist-wtf-260-save-controller-c545e6551107.js
- SHA-256: `c545e655110724b92f2481250dab6878d83bf819977d5caabd0e5dd2729a074b` (downloaded CDN bytes verified).

The header references that exact asset and Pled development source is in sync. The development app, including its demo page, uses the plugin Testing version. Only plugin development source and the dedicated feature branch were updated; no app test/live merge or marketplace publication occurred. Keep the issue open through user acceptance and release verification, and carry these browser cases into WTF-256.

Roll back through a reviewed source revert, restoring the previous header/source and pushing with Pled. The dev-app fixture has the pre-change savepoints above. Keep the active worktree and shared development records intact.
