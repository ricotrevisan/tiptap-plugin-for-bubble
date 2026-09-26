# `code_highlight` rebuilt in `nocode-to-knowcode` (2026-09-26)

The Code Syntax Highlighter plugin's demo page used to be
`tiptap-plugin/version-test/code_highlight`. That page was deleted, and the
whole `tiptap-plugin` app sits behind the run-mode login anyway. The
maintainer asked for it to be rebuilt in the public `nocode-to-knowcode` app.

**Result:** https://nocode-to-knowcode.bubbleapps.io/version-test/code_highlight
- Public: 200 without a login.
- Uses the **published** Code Syntax Highlighter plugin that's installed in
  that app.
- The Bubble editor reports 0 issues.
- In run mode, with a real click on **Highlight code**: 3 code samples
  (JavaScript, Python, CSS), 50 highlighted tokens, no page errors.
- Switching the style from Atom One Dark to GitHub changes the code
  background from dark to white.

## How it was built

Buildprint can't edit `nocode-to-knowcode`. The app is on Bubble's Free plan,
so the invited Buildprint collaborator gets 401. The page was therefore built
with Bubble's own cross-app copy/paste, in the Bubble editor, using the
maintainer's session:

1. **Source page.** On a temporary `tiptap-plugin` branch
   (`code-highlight-src`, `33kpf`), the page was rebuilt from the recovered
   2026-08-21 source (`code-highlight-2026-08-21/`).
   - It has the same elements: the highlighter, a style dropdown bound to the
     highlighter, a "Highlight code" button workflow, and an HTML block.
   - Changes from the original: a heading and an intro sentence, and static
     code samples. The old sample came from a `Doc` record whose text had since
     been overwritten.
   - Verified in run mode on that branch.
2. **Copy.** In the editor: right-click the page's one group → **Copy to
   another app**. This copies the elements and the button workflow.
3. **Paste target.** In `nocode-to-knowcode`: **New → Web page**
   `code_highlight` (blank), then **Upgrade to new responsive** and Column
   layout. New pages in that app start in legacy responsive mode, which
   squashed the first paste.
4. **Plugin version.** `tiptap-plugin` uses the plugin's development version,
   so the copied element and action referred to "Code syntax highlighter
   (testing)", and the editor reported 2 issues. In the copy data, the types
   `1680072712220x425578562619179000_current-AAC/-AAX` were rewritten to the
   published `1680072712220x425578562619179000-AAC/-AAX`, then pasted again:
   0 issues.
5. **Cleanup.**
   - The temporary branch `code-highlight-src` was deleted. It no longer
     appears in `buildprint branch list`, and its URL returns 404.
   - The browser profile that held the editor session was deleted.

## Still open

The Code Syntax Highlighter plugin's own Marketplace demo link still points
to the old URL. That plugin isn't in this repository; update its `demo_page`
to the URL above.
