# WTF-234: Mathematics (LaTeX) — contract

Spec: the "Decided spec — 2026-09-26" on WTF-234. Each numbered case is
covered by `lib/tests/math-lifecycle.mjs` unless it says otherwise.

## Toggle and assets

1. **Mathematics** (`ext_math`) is off by default. Off means no `inlineMath` or
   `blockMath` in the schema, no KaTeX stylesheet, script or fonts requested,
   and the same output HTML as before. Math HTML loaded into an editor with the
   toggle off is not turned into formulas.
2. On: the editor has `inlineMath` and `blockMath` nodes from
   `@tiptap/extension-mathematics` 3.31.3. KaTeX 0.16.29 is **not** in
   `dist.js`. The first editor with Mathematics on adds the pinned jsDelivr
   stylesheet and script, each once per page, with SRI and
   `crossorigin="anonymous"`. The stylesheet loads KaTeX's fonts.
3. Formulas that render before KaTeX has arrived show their raw LaTeX and are
   typeset when it arrives. If KaTeX can't be loaded, they keep showing raw
   LaTeX, the editor keeps working, and the Bubble debugger gets one message.
   A failed stylesheet or script is removed, so the next Mathematics editor
   tries again. When KaTeX does arrive, each Mathematics editor typesets its
   own formulas again, including editors whose attempt failed earlier and
   editors built before Bubble attached them to the page. KaTeX's MathML copy
   stays hidden even if its stylesheet fails.
4. Changing the toggle on a live editor rebuilds it and keeps unsaved content,
   like the other construction-time toggles (AI Toolkit, Find & Replace,
   Table of Contents). Turning it off keeps formulas as their LaTeX text.
   With collaboration this does not apply: an editor without math nodes
   can't hold formulas, and the collaboration binding removes them from the
   shared document (as for any node type an editor lacks). The field doc,
   README and changelog tell developers to turn Mathematics on in every editor
   sharing a document.

## Content

5. Round trip: HTML and JSON from **Content (HTML/JSON)** load back to the same
   document, with **Preserve unknown HTML tags** on (the default) as well.
   Formulas are stored as
   `<span data-type="inline-math" data-latex="…">…</span>` and
   `<div data-type="block-math" data-latex="…">…</div>`. The element's text is
   the raw LaTeX, so HTML shown outside the editor (a Bubble HTML element,
   emails) shows the source instead of nothing. `data-latex` is read back; an
   element without it uses its text as the LaTeX.
6. Invalid LaTeX (`throwOnError: false`) shows its source in red inside the
   editor. Nothing throws, and the content is still saved (`contentHTML`
   updates, autobinding saves).
7. Loading content never converts text: `$x$`, `$5` and `$$x$$` in loaded or
   set content stay text (`migrateMathStrings` is never run).

## Typing

8. Typing `$$x^2$$` makes inline math; typing `$$$\sum x$$$` on its own line
   makes block math (the extension's input rules).
9. Typing currency such as `It costs $5 or $10.` stays text.

## Selection states, click event

10. **Selected math LaTeX** and **Selected math type** (`inline`/`block`)
    describe the formula when a formula is selected (click or keyboard), and
    are empty otherwise. They are published on every selection change and
    content change, so they also follow undo, **Update math** and **Delete
    math**.
11. Clicking a formula in an editable editor selects it, publishes both
    states, then fires **Math clicked** once.
12. In a read-only editor a click does nothing: no selection change, no event.
    (The node test covers the event; the selection part needs a real browser,
    `math.spec.mjs`.)
13. Each editor on the page publishes and fires only for itself.

## Actions

14. **Insert inline math** (LaTeX) inserts at the cursor. **Insert block math**
    (LaTeX) inserts a block at the cursor. Empty LaTeX inserts nothing.
15. **Update math** (LaTeX) replaces the selected formula's LaTeX, inline or
    block, and keeps it selected (the states show the new LaTeX). With no
    formula selected, or empty LaTeX, it does nothing.
16. **Delete math** deletes the selected formula. With no formula selected, it
    does nothing.
17. With Mathematics off, all four actions do nothing and report that the
    extension is off.

## Webhook HTML (server action)

18. **Convert webhook payload to HTML** keeps math nodes with the same HTML as
    the editor (`data-type`, `data-latex`, raw LaTeX text). Before this change
    a document containing math failed to convert. Tested in
    `lib/tests/webhook-html-node18-compatibility.mjs`.
