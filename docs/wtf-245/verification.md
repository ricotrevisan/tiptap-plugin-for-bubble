# WTF-245 / WTF-255 verification

## Fix and reproduction

`node lib/tests/menu-ownership-lifecycle.mjs` first failed with
`bubbleMenu must return to its Bubble parent`. Both menu extensions moved the
Bubble Group into body and removed it without returning it on teardown.

An immediate show/teardown case then exposed a second failure:
`floatingMenu: pending positioning must not mutate released nodes`.
Floating UI promises can complete after the editor is destroyed. Tiptap now
receives a disposable wrapper, while the lease retains the actual Bubble node,
position marker, and exact original attributes. Late positioning writes only
reach the discarded wrapper.

## Automated checks (2026-09-12)

- `cd lib && npm ci && npm test` passed; the suite was rerun after the final wrapper change.
- `npm run validate:plugin` passed: 5 metadata files, 73 function bodies.
- `npm run test:validator` passed: 11 tests.
- `git diff --check` passed.

The new lifecycle test exercises actual bundled menu extensions through the
plugin initialize/update entry points. It covers both menu types shown/hidden,
exact parent/sibling/style/tabindex restoration, repeated release, stale release,
shared-node rejection across editors and menu types, escaped/duplicate IDs,
nearest reusable selection while portalled, AI toggles, menu IDs/enabled flags,
node replacement, removed reusable parents, collaboration document rebuild,
authentication-retry teardown, setup failure, and pending positioning promises.
Collaboration networking is stubbed at the provider seam; this does not test
provider authentication or synchronization.

## Browser smoke check

Preview: https://tiptap-plugin.bubbleapps.io/version-test/tiptap-demo

Tested the existing Notion demo's `notionBubbleMenu` and `notionFloatingMenu`
using a browser-local copy of the final initialize source. The local adapter
shared the real Bubble instance's plugin data and canvas; state/event publishing
was stubbed. This verifies DOM ownership, real layout, and the existing Bubble
button workflows, but is not a deployed-plugin or state-publication check.

- Real pointer click and keyboard selection showed the bubble menu in body.
- Its real Bold button workflow produced `<strong>Project notes</strong>`.
- Clicking the editor and pressing Control+Home showed the floating menu.
- Its real H1 button workflow converted the empty paragraph into a heading.
- Visible teardown returned both exact Group nodes and original style/tabindex.
- Hidden teardown returned both Groups; hidden wrappers had pointer-events:none.
- Both rebuilds reacquired the same Group nodes.
- Reloaded the page afterward, removing the local override.

The shared development plugin has not been pushed. After approval, run
`pled status`, inspect the source diff, `pled push`, and repeat the browser check
without a local override. No runtime bundle changes or CDN upload are needed.
Bubble reset remains disabled.
