# Copied Tiptap demo: recording follow-ups

Target: https://nocode-to-knowcode.bubbleapps.io/version-test/tiptap

The recording was reviewed using Gemini compact full-duration video analysis
(10 fps, maximum 720p, complete audio). An additional source frame confirmed the
address bar; the recording is not from the tiptap-plugin development app.

## Confirmed causes and proposed changes

1. **TOC tracking:** its editor is fit-height inside a 420px scrolling Group, but
   the extension selected `window` during initialization. At inner scrollTop 669,
   the active item was the final heading while “Enable the outline” was visible.
   A local probe giving the editor a fixed height and its own scrolling canvas
   selected the correct scroll parent and highlighted “Configure the editor”,
   the last heading passed at that position. Proposed: fixed 420px Tiptap, with
   its outer frame no longer being a second scroll container.
2. **Drag handle:** it exists and has visibility:visible, but almost its entire
   width lies outside the editor's overflow:hidden canvas. Its center hits the
   surrounding Group, not the handle. A browser-local left gutter moved it
   inside the canvas and the center hit the handle. Proposed: a 32px gutter and
   a scoped 24px handle style through the existing CSS override field.
3. **Popup focus:** the existing button workflow only contains ShowElement.
   Proposed: follow it with the plugin's Focus action, position=end.
4. **Overflow titles:** replace the initial headings “Long note” with “Grows”
   and “Scrolls” in their respective editors.
5. **Repeated content:** page has its main demo Group plus two standalone
   Interactive playground Groups after it. Remove those two copies and their
   ten toolbar workflows; keep the main reusable demos.

`before.json` captures the current page and the four affected reusable
 definitions from the authenticated Bubble editor. `proposed.json` contains the
full reviewable replacement data. All Tiptap file-upload options remain explicit.
Impeccable's mechanical detector reported no findings for the proposed JSON.

## Applied and verified

Applied with user approval to `nocode-to-knowcode`, `test`, page `tiptap` on
2026-09-13. No plugin code changes or live deployment were made.

`applied.json` was exported after reloading the Bubble editor and confirms the
persisted page and four reusable changes. `before.json` is the rollback snapshot.
The popup additionally has an Editor is ready event, gated on popup visibility,
for first-open focus. The button's Focus action is gated on editor readiness for
subsequent opens. This avoids trying to focus before initial editor construction.

Verification on the exact preview URL above:

- Bubble editor: Saved; **0 issues** after reload.
- TOC: real scrolling to 600px selected **Configure the editor**, matching the
  last passed heading. The extension's scroll parent is the 420px editor canvas.
- Drag handle: 24×24px; its center hit-tests to the handle after real pointer hover.
- Popup: first open after a fresh page load and subsequent reopen focus the editor.
  Checked again on mobile after the final workflow changes were saved.
- Titles: **Grows** and **Scrolls**; no “Long note” headings remain.
- Duplicates: one basic playground, ten visible editors, and the install callout
  is the final visible heading after closing the popup.
- No horizontal page overflow at desktop 1280px or mobile 390px.
- Explicit file-upload yes/no settings preserved.

`mobile-footer.png` captures the corrected end of the page at 390px width.
A native branch-creation request earlier did not yield a usable feature preview;
all verified changes above are on the explicitly approved `test` version.
