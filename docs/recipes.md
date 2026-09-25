# Recipes: saving, collaboration, menus and read-only text

Short, tested setups for the questions that come up most on the forum. Each one
is running on the demo page:
https://tiptap-plugin.bubbleapps.io/version-test/tiptap-demo (login `tippy` / `tappy`).

Names in bold are what you'll see in the Bubble editor: the Tiptap
element's fields, states, events and actions, the plugin's server actions, or
Bubble's own labels.

## Who owns the document

Pick one owner for each document. Two owners writing the same field overwrite
each other.

| | Save button | Autobinding | Collaboration |
| --- | --- | --- | --- |
| Where the text lives | Your Thing | Your Thing | The collaboration server |
| Who writes it | Your workflow, when the user clicks | The plugin, while the user types | The server, for everyone in the room |
| When it's written | On click | 2200 ms after the last edit, or right away when the editor loses focus | Continuously |
| What **Content updated** means | The user paused for **Update delay** | The edit was handed to Bubble | Something changed (yours or a collaborator's) |
| Your database copy | Is the document | Is the document | Only a copy you save yourself |

**Content updated** never means "the database has stored it". It means the
plugin handed the edit over. See [Before leaving the page](#before-leaving-the-page).

## Recipe: save button

Use this when the user decides when to save, for example a form with Save and
Cancel.

1. Put the Tiptap element in a group whose data source is the Thing.
2. **Initial content**: the Thing's HTML field.
3. **File uploads enabled**: no (or yes, with **Attach files to** set, if users add images).
4. Leave autobinding off.
5. Save button workflow: **Make changes to a thing**, HTML = Tiptap's **Content (HTML)**.

To show "Unsaved changes", add a condition on a text: Tiptap's **Content (HTML)**
is not the Thing's HTML.

How it behaves:

- **Content updated** fires once the user pauses typing for **Update delay** (default 300 ms). Nothing is written until your workflow does it.
- After you save, the Thing's HTML (your **Initial content**) becomes the same text. The editor keeps what it shows.
- If **Initial content** changes to something else, the editor loads it. Don't point **Initial content** at a value that changes while the user types.
- Unsaved text is lost on reload.

Demo: "Save to your database" → Save button.
Tested by `lib/tests/document-ownership-lifecycle.mjs` and in a real Bubble
app ([verification](wtf-263/verification.md)).

## Recipe: autobinding and switching records

Use this when the text should save itself, for example notes or a CMS page.

1. Put the Tiptap element in a group whose data source is the Thing.
2. Turn on autobinding to the Thing's text field (HTML).
3. **Autobinding record ID**: the Thing's unique ID. This tells the plugin which record it's editing, even when two records hold the same text.
4. **Autobinding save delay**: default 2200 ms. Lower it for faster saves; 0 saves on every change.
5. **File uploads enabled**: no (or yes, with **Attach files to** set).
6. Leave **Initial content** empty. Autobinding loads the text.

How it behaves:

- The plugin saves 2200 ms after the last edit. If the text didn't change, it doesn't save.
- When the editor loses focus, it saves right away, before your **isn't focused** workflow runs. Clicking a button blurs the editor, so a Save or Next button hands over the pending edit first.
- Switching the group to another record loads that record. An edit that hadn't been handed over yet is dropped, never written into the new record. Switching by clicking a button saves first (the click blurs the editor).
- If the Thing changes elsewhere, the editor loads the new text, even while focused.
- If a slow save comes back after newer typing, the editor keeps the newer text and saves it again.
- **Update delay** (300 ms) doesn't control autobinding saves; **Autobinding save delay** does.
- To restore an older version on purpose, use **Set content**. Restoring text that exactly matches an earlier save looks like a late echo and is ignored.

Don't also save the same field with a Save button. Two writers can overwrite
each other.

Demo: "Save to your database" → Note A / Note B.
Tested by `lib/tests/autobinding-record-lifecycle.mjs`; timing, blur and
switching were also checked in a real Bubble app
([verification](wtf-263/verification.md), and [WTF-260](wtf-260/README.md) for
slow saves and record switches without a blur).

### Before leaving the page

The plugin tells you when it handed an edit to Bubble. It can't tell you when
the database stored it.

- Clicking the button that navigates blurs the editor, so the pending edit is handed over before the button's workflow runs.
- **Content updated** means "handed over", not "stored".
- A record switch that doesn't blur the editor (a delayed workflow, a keyboard shortcut) drops the unsent edit.

To avoid depending on timers, save explicitly as the first step of the
navigation workflow (**Make changes to a thing** with **Content (HTML)**), then
**Go to page**. That still isn't a confirmation from the server. If your app
needs one, it has to come from Bubble's server, for example a backend workflow
that reports back. Neither the plugin nor the demo page provides that.

## Recipe: menus in reusables and repeating groups

Use this for a bubble menu (shows on text selection) or a floating menu (shows
on an empty line) built from your own Bubble buttons.

1. Inside the same reusable or repeating-group cell as the editor, add a Group with your buttons. Give it an **ID Attribute**, for example `noteBubbleMenu`. Leave it visible on page load; the plugin hides and shows it.
2. On the Tiptap element: **Bubble Menu** yes, and **Bubble menu** = `noteBubbleMenu`. For a floating menu, use **Floating Menu** and **Floating menu**.
3. **File uploads enabled**: no (or yes, with **Attach files to** set).
4. Each button runs a Tiptap action on its own editor, for example **Bold** or **H1**.

How it behaves:

- The plugin looks for the group with that ID closest to the editor. The same ID in every copy of a reusable, or in every repeating-group cell, is fine: each editor takes its own group.
- One group serves one editor. If another editor already uses it, the plugin leaves it alone and reports it in the debugger.
- If the ID isn't found, the debugger says so.
- Changing a menu ID rebuilds the editor. Unsaved text is kept.

Wait for the editor before running actions. Use the **Editor is ready** event,
or check **Is ready**. Actions that run earlier are skipped and reported in the
debugger.

Demo: "A Notion-like editor" (a reusable with both menus).
Tested by `lib/tests/menu-ownership-lifecycle.mjs`, which covers two reusables
using the same menu ID.

## Recipe: read-only text with the editor's styles

Heading sizes, colors, link styles and CSS overrides are settings on the Tiptap
element. The HTML you save holds the structure and text, not those styles, so a
plain Bubble text or HTML element shows it unstyled.

To show saved HTML exactly like the editor:

1. Add another Tiptap element with the same style settings (or the same element style).
2. **This input is enabled**: unchecked.
3. **Initial content**: the Thing's HTML.
4. **Bubble Menu** and **Floating Menu**: no.
5. **File uploads enabled**: no.

When the Thing changes, the read-only view updates. To make it editable later,
switch **This input is enabled** with a condition.

Styles that are part of the text itself, such as **Set color** or **Set font
size**, are saved in the HTML as inline styles.

Demo: "Save to your database" → Read-only view of the saved note.
Tested by `lib/tests/document-ownership-lifecycle.mjs`; styles were compared
in a real Bubble app ([verification](wtf-263/verification.md)).

## Recipe: live collaboration with Tiptap Cloud

Several people edit the same document at once, with named cursors.

You need a Tiptap Cloud app. Its ID is the **Doc Server ID**. Put its secret in
the plugin settings as **Tiptap Cloud document server secret**. It stays on the
server.

1. **Page is loaded** workflow: run **generate auth token** with **Doc Server ID**, **Document names (comma-separated)** = your document name, **Which document server secret to use** = Tiptap Cloud. Then **Set state** on the page or reusable to its **auth token**.
2. On the Tiptap element:
   - **Enable collaboration?** yes, **Provider** tiptap.
   - **Doc Server ID**: your app ID.
   - **Document name**: one name per document, for example the Thing's unique ID.
   - **JWT key**: the state from step 1.
   - **user_name** and **cursor_color**: the current user's name and color.
   - **Initial content**: only used when the room is empty.
   - **File uploads enabled**: no (or yes, with **Attach files to** set).
   - Leave autobinding off. If it's on, the plugin ignores it and says so in the debugger.
3. Show **Collaboration status**, **Collaboration synced?** and **Collaboration connected users** if you like.

How it behaves:

- Until the token arrives, the editor waits and the debugger says it's waiting for credentials. **Is ready** turns yes once it starts.
- The document lives on Tiptap Cloud. Everyone with the same **Document name** edits the same text.
- **Content updated** fires on every change, yours and every collaborator's, in every open browser. Don't save to the database on it.

Keep a copy in your database with a Save button: **Make changes to a thing**,
HTML = Tiptap's **Content (HTML)**. Add **Only when** Tiptap's **Is ready** is
yes. Show that copy anywhere with the read-only recipe above.

Demo: "Edit together, live". Open it in two browsers.
Tested by `lib/tests/document-ownership-lifecycle.mjs`,
`lib/tests/collaboration-configuration-lifecycle.mjs` and
`lib/tests/collaboration-auth-lifecycle.mjs`; the two-browser setup was checked
in a real Bubble app ([verification](wtf-263/verification.md)).

### Your own Hocuspocus server

Same steps, with **Provider** custom, **Custom - URL** = your server's `wss://`
address, the secret in **Custom collab document server secret**, and **Which
document server secret to use** = Custom. This uses the same connection code as
Tiptap Cloud, but it hasn't been checked end to end in a real Bubble app for
this guide.

### Liveblocks

Not covered yet. Its setup hasn't been verified in a real Bubble app.

### Saving through Tiptap Cloud webhooks

This doesn't work in Bubble yet. Tiptap Cloud's "document saved" webhook sends
the document as a JSON object (`tiptapJson`). **convert webhook payload to
HTML** needs it as text, and Bubble can't pass it on:

- A backend workflow with a text parameter for `tiptapJson` rejects the call ("Expected a string, but got a object").
- With detected request data, the raw body text arrived empty.

The converter itself handles the full webhook body when it gets it as text
(tested by `lib/tests/webhook-html-node18-compatibility.mjs`). Until there's a
supported way in, save a copy from the page as shown above.
