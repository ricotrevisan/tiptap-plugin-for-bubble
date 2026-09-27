# WTF-263: recipes — verification

## Scope

- New user guide: [docs/recipes.md](../recipes.md). The README links it and
  says the recipes run on the development demo page (`tiptap-plugin` /
  `tiptap-demo`, login tippy / tappy). The README's "Live demo" and the
  Marketplace demo link are main's public `nocode-to-knowcode` page (WTF-256).
- Plugin change: only text. The whoistyping.wtf links in the `src/plugin.json`
  description, plus two collaboration help texts in `AAC.json`/`fields.txt`. It reaches Bubble
  only through the ship session's `pled push`. `lib/index.js` and the element
  code are untouched, so no new CDN asset or header change is needed.
- New tests:
  - `lib/tests/recipes-docs-contract.mjs`: every bold name in the recipes is a
    real element field/state/event/action, server action field, plugin key or
    an allowlisted Bubble label. Every recipe states **File uploads enabled**
    explicitly and cites a lifecycle test that runs in `npm test`. Defaults
    quoted (2200 ms, 300 ms) match `AAC.json`. README and `src/plugin.json` link the
    public demo, the recipes link the development demo, and no old demo
    appears anywhere. No Liveblocks setup steps (excluded by
    the maintainer).
  - `lib/tests/document-ownership-lifecycle.mjs`: six scenarios through the
    real `initialize.js` / `update.js` / `dist.js` for the claims the existing
    suites didn't cover: explicit save events and no autobinding writes; the
    saved value returning as **Initial content** is reloaded (identical text
    fires nothing; typing in between is replaced); read-only view
    follows **Initial content**; collaboration waits for the token, then
    starts; autobinding is ignored while collaborating (writes and incoming
    values); **Content updated** fires on every local and remote collaborative
    change.
  - `lib/tests/webhook-html-node18-compatibility.mjs`: adds Tiptap Cloud's
    `document.saved` body (`tiptapJson`) passed whole as text.

## Red → green

- `recipes-docs-contract.mjs` before the docs: failed at `README links the
  canonical demo page` ([red-before-docs.txt](red-before-docs.txt)). After:
  `PASS recipes docs contract (86 bold terms, 5 recipes)`.
- The docs test also failed while drafting on four bold terms (`bold` in the
  intro, and three names wrapped across lines). The wrap was a test bug
  (Markdown reads a line break as a space); the intro was rewritten.
- `document-ownership-lifecycle.mjs` characterizes existing behavior, so it
  passed first time. Mutation check: removing `&& !properties.collab_active`
  from the autobinding branch in `update.js` makes "collaboration owns the
  document: autobinding is ignored" fail. Source restored.

## Real Bubble verification (2026-09-25)

- Bubble app `tiptap-plugin`, feature branch `wtf-263-recipes` (`73knr`),
  created from `test`. Savepoint before changes: `1790343414572`.
- Preview: https://tiptap-plugin.bubbleapps.io/version-73knr/tiptap-demo
  (login `tippy` / `tappy`). Plugin: development version, unchanged.
- Branch status: **demo to keep**, merged into `test` on 2026-09-26 with the
  maintainer's authorization (see "Rework round 1" below).
- Added reusables `demo-saving` and `demo-collaboration` to `tiptap-demo`
  after `demo-outputs`. Their BubbleScript is in [fixture/](fixture/). Every
  new Tiptap element sets **File uploads enabled** to no.
- New development records (titles start with `Recipe:`): save button
  `1790343746792x662993404464832000`, autobind A
  `1790343746793x195133471709167070`, autobind B
  `1790343746826x263583170732905920`, collaboration copy
  `1790343746792x915641002873984500`. Their text was reset after testing.
- Collaboration uses Tiptap Cloud app `nrm8d1ko`, document
  `tiptap-demo-recipes`, with the token from **generate auth token** on page
  load. (The older unused `Portable Multiplayer Demo` reusable points at
  `nrm8g1ko`, which doesn't resolve.)

All checks used real keyboard typing and real mouse clicks (agent-browser),
and read the development database through Buildprint.

| Recipe | Check | Result |
| --- | --- | --- |
| Save button | Edit shows "Unsaved changes"; database unchanged | ✓ |
| | Click Save → database has the edit; status "All changes saved." | ✓ |
| | Type immediately after clicking Save | Newer typing kept; database has the saved text |
| | Reload | Saved text shown; unsaved typing gone (expected) |
| Autobinding | Time from last keystroke to saved value (read-only view) | 2214 ms (default 2200) |
| | Type, then click outside the editor | Saved after 50 ms (blur flush) |
| | Type, then click Note B within the delay | A saved (click blurred first); B unchanged |
| | Reload | A and B hold their own text |
| Read-only | Editor vs read-only H2 styles | Both 24px / 800 / `0 0 8px`; read-only not editable |
| Collaboration | Two browser sessions | Both `connected`, synced, 2 people |
| | Type in A, then in B | Each sees the other's text; carets labelled "Guest" |
| | Save a copy in B | Database copy has the shared text; A's read-only view updated |
| | Before the token arrives | Debugger: waiting for credentials; then connected |

Screenshots: [demo-saving.png](demo-saving.png),
[demo-collaboration.png](demo-collaboration.png).

### Webhook persistence (not a working recipe)

To test the Tiptap Cloud webhook path, the branch temporarily got an exposed
backend workflow (`tiptap_document_saved`, kept as
[fixture/webhook-probe-removed.ts](fixture/webhook-probe-removed.ts)) and the
Workflow API was switched on for the branch only. A `document.saved`-shaped
body (from Tiptap's docs) was posted to it:

- Manual parameters with `tiptapJson` as text: HTTP 400 `Invalid data for key
  tiptapJson: Expected a string, but got a object`.
- Detected request data, passing `Request Data's raw body text` to the
  converter: `name` was read, but the raw body was empty, so the converter
  returned `The payload is empty`.

The probe workflow was deleted and the Workflow API switched off again on the
branch; the endpoint now returns `does not expose a Workflow API`. The recipes
document this and recommend a Save-a-copy button instead. A supported path
(for example a server action that fetches the document from Tiptap Cloud's
REST API by name) is a product decision for a follow-up.

## Not verified

- **generate auth token** signing with the app's **Custom collab document
  server secret**: that saved key belongs to another project (see "Rework
  round 3"). Tested with a locally signed token instead.
- Liveblocks: excluded from these recipes and their tests (maintainer,
  2026-09-26).
- **Go to page** with an autobinding write still in flight: not checked. The
  recipe says so.
- Record switch without a blur in real Bubble: not repeated here. It's covered
  by `autobinding-record-lifecycle.mjs` and WTF-260's browser checks.
- Menus in a repeating group in real Bubble: covered by
  `menu-ownership-lifecycle.mjs` (two containers with the same menu ID); the
  demo page shows menus in a reusable only.
- Server-confirmed save before navigation: the recipes say neither the plugin
  nor the guide provides it; no pattern was built.
- Two people opening a brand-new collaborative document at the same moment can
  both seed **Initial content** (found by review with offline providers). The
  recipe warns about it; the plugin is unchanged.
- The **convert webhook payload to HTML** help text still says to pass
  "Request Data's body". Changing it is a `src/` change for a follow-up.

## Review

Independent read-only review of `523eff4`: approve with findings, none
blocking. Fixed in the next commit:

- Demo branch marked **demo to keep** above.
- "Before leaving the page" no longer suggests a second writer next to
  autobinding. It says a button click hands the edit over, and that a server
  confirmation isn't provided.
- Save button: "the editor keeps what it shows" was too broad. The test now
  types during the round trip. It asserts that the reload replaces that typing,
  that an identical reload fires nothing, and that a different one fires
  **Content updated** once. (The reviewer expected an event on the identical
  reload; the test shows none.) The docs say the same.
- Warning about double **Initial content** in a brand-new room.
- Custom server: what **Doc Server ID** does there (URL path, token audience).
- Webhook wording: "we couldn't find a way" rather than "doesn't work".
- Smaller wording fixes: an external change also drops an unsent edit;
  "handed over" instead of "saves" for autobinding; an empty value doesn't
  clear the read-only view; "almost all" actions report running before ready
  (Select entire block is silent); what "restoring" means.
- Removed unused Bubble labels from the test allowlist.

Second pass on `20279f3`: approve with findings. It confirmed the refutation
(Tiptap skips the update event when the document is unchanged). Fixed in the
next commit: "Before leaving the page" now limits the claim to what was tested
(same-page switches). Going to another page with a write still in flight is
listed as unchecked. Two remaining "saves" became "hands over".

## Historical checks (Node 24, from `lib/`)

`npm ci`, `npm test` (22 scripts), `npm run validate:plugin` (5
metadata files, 73 function bodies), `npm run test:validator` (11 tests),
`npm run test:browser` (27 passed across Chromium, Firefox and WebKit), and
`git diff --check`. All passed. After merging main in rework round 1:
`npm test` (22 scripts) and `npm run test:browser` (61 passed) also pass.

## Rework round 1 (2026-09-26)

Maintainer feedback:
- Liveblocks is excluded from tests.
- The Hocuspocus server is `collab.whoistyping.wtf`.
- Change the plugin's demo links.
- Merging branches into `test` on `tiptap-plugin` is authorized.

Changes:
- Merged `origin/main` (WTF-262) into the branch. Resolved conflicts: both
  Unreleased CHANGELOG entries are kept, and `npm test` runs main's list plus
  the two new tests.
- `src/plugin.json`: `demo_page` and the description's demo link now point to
  the canonical demo page (with the tippy/tappy login). Red first: the new
  assertion failed on the old file with `plugin demo page is the canonical
  demo` ([red-before-plugin-demo-links.txt](red-before-plugin-demo-links.txt)).
  These reach Bubble when the ship session runs `pled push`.
- Recipes:
  - The Hocuspocus section now covers whoistyping.wtf: **Custom - URL**
    `wss://collab.whoistyping.wtf`, **Doc Server ID** = the project's
    Document Server ID (added as the URL path), and the secret in **Custom
    collab document server secret**. This follows the portal's own Bubble
    help (`RicoTrevisan/hocuspocus`).
  - Liveblocks is stated as outside the recipes and their tests.

Hocuspocus check (not verified end to end):
- `https://collab.whoistyping.wtf` answers "Welcome to Hocuspocus!".
- A direct Node connection to `wss://collab.whoistyping.wtf/yWHcOw05` (the
  older 1Password `tiptap` item's server path), signed with that item's
  document server secret, got `permission-denied`.
- A temporary probe page on `wtf-263-recipes` (provider custom, same path,
  token from **generate auth token** with the app's **Custom collab document
  server secret**) connected, then failed authentication.
- The probe page was deleted afterwards.
- A valid whoistyping.wtf project (its Document Server ID and secret) is
  needed to finish this check.

Demo merged into `test`:
- Buildprint has no branch-merge command, so exactly this branch's changes
  were applied to `test`: the reusables `demo-saving` and
  `demo-collaboration`, and their two instances on `tiptap-demo`. `test` had
  moved on through other work; nothing else was touched.
- Savepoint before the change: `1790393693225`.
- Real run mode, `version-test/tiptap-demo`:
  - both sections render (15 editors);
  - collaboration connected and synced;
  - the autobind edit reached the read-only view 2215 ms after the last
    keystroke;
  - Save wrote the database.
- Demo records were reset afterwards.
- Branch `wtf-263-recipes` (`73knr`) still exists; it is merged, so the ship
  session may delete it.

## Rework round 2 (2026-09-26): whoistyping.wtf

Maintainer: replace every `tiptap.rico.wtf` reference with `whoistyping.wtf`.

- Replaced in `src/plugin.json` (description, 2 links), `AAC.json` (the
  collaboration help label and the **Doc Server ID** help, both in styled bold
  letters, which were kept) and `fields.txt` (the same label).
- `.src.json` still has the old text: it is Pled's record of the pushed plugin
  and updates with the ship session's `pled push`. The `rico.wtf` in
  `factory/prompts/ship.md` is the Buildprint workspace name, not the site.
- Red first: the new assertion failed with `src/plugin.json no longer points at
  tiptap.rico.wtf` ([red-before-whoistyping.txt](red-before-whoistyping.txt)).
  The check compares NFKC-normalized text, so styled letters count. Green
  after.
- The label's "(has free tier)" note was kept as it was.

### Merge with main (WTF-256)

Main moved to `92592c3`, and the PR had a merge conflict. That's also why the
last two pushes started no `pull_request` CI run. WTF-256 records the
maintainer's answer "Demo link → a `nocode-to-knowcode` page": the Marketplace
`demo_page`, the description's Demo line and the README "Live demo" now point
to the public https://nocode-to-knowcode.bubbleapps.io/version-test/tiptap,
which needs no password. Resolution:

- Main's public demo link is kept for the Marketplace and README (the
  maintainer's latest decision on those links).
- The whoistyping.wtf replacements are kept.
- The README also links the recipes, and says they run on the development demo
  page (login tippy / tappy), where their sections live.
- `recipes-docs-contract.mjs` now expects the public demo for the README and
  the Marketplace, the development demo for the recipes, and neither old demo
  anywhere.
- CHANGELOG keeps both Unreleased sections.
- Gates after this merge: `npm test` (22 scripts), `validate:plugin`, `test:validator` (11), `test:browser` (105 passed).

### Save a copy waits for sync (drummer review of `977c789`)

- Finding (important, valid): the collaboration **Save a copy** only waited
  for **Is ready**. Before the first sync the editor is empty (the starting
  text is only added after sync, into an empty room), and after a dropped
  connection it may lack collaborators' latest edits. A click then would
  overwrite the database copy. (Wording corrected after the independent review.)
- Red first: a new contract assertion requires the collaboration recipe to say
  **Only when** **Is ready** and **Collaboration synced?**. It failed on the
  old text ([red-before-synced-save.txt](red-before-synced-save.txt)); green
  after the recipe was fixed.
- Bubble: the `Save a copy clicked` condition is now `is_ready and
  collab_synced`, on `wtf-263-recipes` and on `test` (savepoint
  `1790417151846`). The fixture copy is updated.
- Real run mode, `version-test/tiptap-demo`: with the document synced, typing
  then Save a copy updated the database copy, and the read-only view showed
  it. The unsynced case wasn't reproduced in real Bubble: the browser tool's
  request blocking doesn't affect websockets, and going offline would also
  block the database write. It relies on the Bubble condition, which
  Buildprint validated.

## Rework round 3 (2026-09-27): whoistyping.wtf verified; public demo URL

The maintainer provided a whoistyping.wtf project's credentials (server ID
`81df851b` and its server secret).

- Direct Node connection to `wss://collab.whoistyping.wtf/81df851b` with a
  token signed from that secret: authenticated and synced.
- Real Bubble, branch `wtf-263-recipes` (`73knr`), temporary probe page
  (**Provider** custom, **Custom - URL** `wss://collab.whoistyping.wtf`,
  **Doc Server ID** `81df851b`):
  - with **generate auth token** (Custom): authentication failed 5/5. The
    app's saved **Custom collab document server secret** belongs to another
    project; plugin key values are app-wide and Buildprint can't set them, so
    it wasn't changed.
  - with a 10-minute token signed locally from the project secret and passed
    in by URL: two browsers `connected`, synced; typing in each showed in the
    other, with "Probe" carets. After one closed and the other reloaded, the
    text came back from the server.
  - The probe page was deleted afterwards.
- Plugin token (after review of `bf4755c`): the plugin's own
  `generate-auth-token/server.js`, run locally with **Which document server
  secret to use** = Custom and the project secret, produced a token with
  `sub`, `allowedDocumentNames`, `iat`, `exp` and `aud` = `81df851b`.
  Connecting with it to `wss://collab.whoistyping.wtf/81df851b`:
  authenticated and synced.
- Not run together in Bubble: saving the project secret in the app's plugin
  settings and minting in Bubble. The recipe says exactly this.
- Public demo URL: main's Marketplace `demo_page`, description and README
  pointed to `https://nocode-to-knowcode.bubbleapps.io/version-test/tiptap`,
  which now returns 404. AGENTS.md (main `e0cd48b`) names
  `…/version-test/tiptap-demo` (200). All four links now use it. Red first: the
  contract test failed with `README links the public demo page`
  ([red-before-public-demo-404.txt](red-before-public-demo-404.txt)). The test
  also rejects the retired `/tiptap` URL. `.src.json` shows the pushed plugin
  still has the 404 link until the next `pled push`.
- The earlier merge note above names `/tiptap`; that was main's link then.
- Gates at that revision: `npm test` (22 scripts), `validate:plugin`, `test:validator` (11), `test:browser` (106 passed).

## Rework round 4 (2026-09-27): current main and Math

Merged `origin/main` (`dee7c42`) into the PR branch. This section supersedes the
older gate counts and link/conflict notes above; those describe their historical
revisions, not the current PR review receipt.

- Kept main's KaTeX build alias, Math dependencies, Math lifecycle/browser tests,
  Math asset metadata, actions, states and webhook HTML conversion case. The
  `document.saved` converter case and both WTF-263 tests still run in `npm test`.
- Kept the public `/version-test/tiptap-demo` Marketplace and README links,
  the recipes link and the whoistyping.wtf plugin help/description. The released
  v4.13.0 changelog is unchanged; this ticket's entry is now **Unreleased**.
- Tightened the recipes: the tested Bubble webhook intake attempts didn't
  produce usable JSON text, but the converter itself accepts a complete body
  as text. Conversion alone doesn't save a Thing. Same-page button switching
  hands off pending autobinding edits without proving database acknowledgement;
  navigation with an in-flight save remains unverified.
- `npm ci`, `npm test` (including Math, document ownership and recipes),
  `npm run validate:plugin` (5 metadata files, 77 function bodies),
  `npm run test:validator` (11 passed) and `npm run test:browser` (124 passed,
  8 expected skips) succeeded on Node 24. The browser suite ran in Chromium,
  Firefox and WebKit. The eight skips are the gated Tiptap Cloud integration
  cases and Firefox/WebKit IME cases.
- Review follow-up: the recipes now require separate IDs for Bubble and
  Floating menu groups, and explicitly limit the real Bubble menu check to
  reusable copies (repeating-group lookup has lifecycle-test coverage). The
  collaboration demo *fixture* now spells out the `Is ready` + `Collaboration
  synced?` guard already present on its Save-a-copy workflow. The live Bubble
  demo's explanatory text has **not** been updated by this Git change; it
  must be synced separately before claiming that copy is fixed in the app.
- No Bubble editor/plugin mutation, Marketplace release or public demo edit
  was part of this rework. The development demo evidence above predates this
  merge, but this merge changes no Tiptap runtime behavior or demo configuration.

## Rework round 5 (2026-09-27): Emoji release on main

Merged `origin/main` (`531185c`, PR #58) into this branch using the existing
merge-commit convention. This supersedes round 4's gate counts. Kept Emoji's
runtime dependency, lockfile, bundle URL, fields/action, webhook conversion,
unit/browser tests and published v4.14.0 changelog; kept this ticket's recipes
and metadata edits under **Unreleased**. The merged webhook test exercises
Math, Emoji and the `document.saved` body. The PR diff against main contains
only the WTF-263 changes.

`npm ci`, `npm test` (Math, Emoji, document ownership and recipes),
`npm run validate:plugin` (5 metadata files, 78 function bodies),
`npm run test:validator` (11 passed), and `npm run test:browser` (131 passed,
10 expected skips across Chromium, Firefox and WebKit) succeeded on Node 24.
No plugin push, Bubble page edit, Git PR merge or release was performed by this
branch update. The live demo copy caveat in round 4 still applies.
