# WTF-260: autobinding regression

**2026-09-11: the fix is incomplete.** A real typing test reproduced final database data loss from out-of-order saves. See the [follow-up investigation](investigation-2026-09-11.md). The results below cover the original patch and do not establish save convergence.

The editor now ignores echoes of its own saves, cancels pending callbacks when the bound record changes, and loads incoming content without saving it back. Blur submits one dirty edit; clean blur does not write. Record changes also prevent Undo or a simultaneous extension rebuild from restoring the previous document.

## Configure SPA editors

Set **Autobinding record ID** to the same parent Thing's unique ID used by Bubble autobinding. This is necessary to distinguish records with identical HTML. An editor permanently bound to one record can leave it blank. Without the ID, only changed content that is not a known save echo can identify incoming documents.

A record switch cancels the previous record's pending debounce. If the last edit must be saved, keep that record bound until **Content updated** before switching. That event means the save was submitted, not acknowledged by the database. The plugin cannot redirect a native Bubble autobinding write to a Thing that is no longer bound.

A legitimate incoming value that differs from previous local saves still replaces the editor, including while focused. Restoring exactly an earlier local save is indistinguishable from a delayed echo; use an explicit Set content workflow for intentional restores. Collaboration remains the source of truth when enabled. No reset-function workaround is involved.

## Test environment

- Git branch: `fix/wtf-260-autobinding`, based on `91d1d43`.
- Bubble app: `tiptap-plugin`; feature branch `wtf-260-autobinding` (`33jpy`), created from `test`.
- Preview: https://tiptap-plugin.bubbleapps.io/version-33jpy/wtf-260-autobinding
- Run-mode login: `tippy` / `tappy`.
- Savepoint before fixture changes: `1789046933075`.
- Disposable development Docs: A `1789047006074x991054080173902500`; B `1789047009959x299667751052360450`. Their Titles start with `WTF-260`. Feature branches share development data; only these two test records were changed.
- Native autobinding is enabled on HTML (`html_text`); File uploads enabled is explicitly **no**. Mention content type is Doc; mentions and collaboration are disabled.

`fixture/` captures the final BubbleScript page and workflows. `fixture-native.json` captures its actual Bubble representation, including native plugin settings that Buildprint does not project into typed plugin properties. These are reference fixtures, not an instruction to apply over an existing app. Create a dedicated branch and disposable records when recreating them.

## Verification

The baseline source at `91d1d43` failed deterministic stale-echo and pending-record-switch tests. In the real Bubble fixture, real typing followed by replaying an older value into the disposable record's reactive cache changed `... first second` back to `... first`. The replay invokes Bubble's real plugin update lifecycle; it deliberately injects the delayed response rather than relying on network timing.

With the patch, the same browser replay passes at **0 ms and 300 ms**, preserving both HTML and selection. The navigation check observes an actual pending A edit before the delayed Bubble workflow selects B, verifies B is unchanged, hides/switches/shows the editor, recreates it through reload, and confirms a real edit in B persists across reload. Development database reads also confirmed the saved text.

Ordinary pointer navigation did not organically reproduce an A-to-B database overwrite before the patch. The unsafe callback path is demonstrated by deterministic lifecycle tests; do not describe that as an observed production overwrite. This fixture uses the plugin's **development version**. A separately pinned marketplace-version comparison and post-publication check remain release verification; this change does not establish that every current marketplace installation reproduces either report.

Automated validation passed: the full `npm test` build/lifecycle suite, 15 dedicated autobinding scenarios, plugin validation (73 function bodies), and all 11 validator tests. Dedicated coverage includes delays 0/300, identical records, external updates, blur, teardown, detach/reattach, explicit save workflows, 260 delayed save snapshots, Undo, and simultaneous extension rebuild/record switch.

From `lib/`, run:

```sh
npm ci
npm test
npm run validate:plugin
npm run test:validator
```

For the real browser checks, open an authenticated `agent-browser` session named `wtf260` on the exact preview above. From the repository root:

```sh
python3 lib/tests/browser/replay-autobinding-echo.py --delay 0
python3 lib/tests/browser/replay-autobinding-echo.py --delay 300
python3 lib/tests/browser/check-autobinding-navigation.py
```

These browser scripts mutate only the disposable fixture records and depend on Bubble's internal client-cache shape. They are manual integration checks; the deterministic lifecycle tests run in CI. The pending-navigation script asserts that an edit really was pending, so a slow browser run fails instead of silently claiming race coverage.

## Release and rollback

Only the shared plugin development version and the dedicated Bubble feature branch were updated. No `test`/`live` app changes, merge, marketplace publication, or branch deletion occurred. No runtime bundle source/dependency changed, so no CDN bundle release was needed.

Review the PR and configure the new record-ID setting wherever a single autobound editor switches Things. Keep WTF-260 open through marketplace/release verification and carry these scenarios into WTF-256. Roll back plugin code through a reviewed source revert and Pled push; the dev-app fixture has its pre-change savepoint. Do not reset or delete another worktree or shared development records.
