# Submit on Enter — verification

Requested for the Relay chat template (`app-shell-template`). Its composer is a
Tiptap element, and so far a message could only be sent with a Send button.

## Contract

With **Submit on Enter** = yes, a keydown is "submit" when all of these hold:

- the key is Enter, with no Shift, Ctrl, Alt or Cmd held;
- no IME composition is in progress (`isComposing` or keyCode 229);
- the editor is editable;
- no mention list is open (this plugin's suggestion popup);
- no ancestor of the cursor (selection start) is a code block, list item or task item.

Then Enter pressed fires and no newline is added. Pending edits are flushed
first, as on blur, so Content updated (if pending) fires before Enter pressed.
Anything else gets Enter's usual behavior. With Submit on Enter = yes, Shift+Enter
(when no exception applies) is left to Hard Break (`<br>`). Without Hard Break,
it runs createParagraphNear → liftEmptyBlock → splitBlock, which is what Enter
did before. With the property off, the plugin returns early and nothing changes.

The property is read on each keypress from the latest properties, so a dynamic
value (for example "yes only on wide screens") applies without rebuilding the editor.

## Tests

- `lib/tests/submit-on-enter-lifecycle.mjs` (in `npm test`): off by default,
  fires once with no newline, text is current when the event fires, Content updated
  fires before it, empty editor, Shift+Enter with and without Hard Break,
  Ctrl/Alt/Cmd, IME, code block, bullet/numbered/task lists (including leaving a
  list), mention list, dynamic toggle without a rebuild, read-only.
  Mutation check: removing the mention, code/list or IME guard fails the test.
- `lib/tests/browser/submit-on-enter.spec.mjs`: real keyboard, 8 scenarios.
  Chromium 8/8; Firefox and WebKit 7/7, plus 1 IME case skipped because IME
  input only runs through CDP. Full `npm run test:browser`: 335 passed, 22
  skipped, 0 failed.
- `npm test`, `npm run validate:plugin` and `npm run test:validator` pass.

## Real Bubble

App `tiptap-plugin`, branch `relay-submit-on-enter` (`53mcy`), created from
`test`. Savepoint `1792407060480` was taken before `buildprint apply`. The new
reusable `demo-chat-composer` is on `tiptap-demo`, after the mentions demo. It has a
composer (Submit on Enter yes, Hard Break yes, File uploads enabled no), a Send
button, and a readout fed by two workflows: When Composer editor Enter pressed, and
Send button clicked. Each runs only when Is empty? is no, then sets the states and
runs Clear contents. The plugin development version was pushed with `pled push`
(In sync) first.

URL: `https://tippy:tappy@tiptap-plugin.bubbleapps.io/version-53mcy/tiptap-demo`.
Tested in Chromium with real clicks and keypresses.

Desktop (1280 px):

| Input | Result |
| --- | --- |
| `Hi!` Enter | Sent 1, last message `Hi!`, editor cleared |
| `Line one` Shift+Enter `Line two`, then Enter | `<p>Line one<br>Line two</p>`, sent with both lines |
| Enter in the empty editor | Nothing sent (Is empty? condition) |
| `-` Space `milk` Enter `eggs` | `<ul>` with two items, nothing sent |
| Enter ×2 (empty item, leaves list), Enter | Sent |
| ```` ``` ```` Space `x = 1` Enter `y = 2` | `<pre><code>x = 1\ny = 2</code></pre>`, nothing sent |
| ArrowDown, `see above`, Ctrl+Enter | `<br>` added, nothing sent |
| Enter | Sent (code block + text) |
| `via button`, click Send | Sent, "last one with Send button" |
| Basic demo editor (property off), Enter | New paragraph (15 → 16 `<p>`) |

390 px wide: the composer and Send button fit without horizontal overflow, and
the composer grows to three lines with Shift+Enter. Enter sent
`Three lines\non a narrow\nscreen` and cleared the editor. The first placeholder
was too long for 390 px and was clipped, so the demo now uses `Write a message…`.

![Desktop: Shift+Enter message sent](desktop-shift-enter-sent.png)
![390 px: three lines before Enter](390-multiline-before-enter.png)
![390 px: after Enter](390-after-enter.png)

## Notes

- Content (Plain Text) separates block nodes (list items, paragraphs) with
  blank lines. That is existing Tiptap `getText` behavior. Chat apps should
  save Content (HTML).
- On touch keyboards, Enter sends too. Builders who want a newline on phones
  can bind Submit on Enter to a condition such as the page width.
