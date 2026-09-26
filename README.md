# Rich Text Editor (Tiptap.dev) — Bubble.io Plugin

A full-featured rich text editor for [Bubble.io](https://bubble.io) built on [Tiptap v3](https://tiptap.dev). Drop it into any Bubble app and get a modern editing experience — formatting, tables, images, collaboration, and 55+ editor actions — without writing a line of code inside Bubble.

**[Install the plugin](https://bubble.io/plugin/rich-text-editor-tiptapdev-1670612027178x122079323974008830)** · **[Live demo](https://nocode-to-knowcode.bubbleapps.io/version-test/tiptap)**

---

## Why use this plugin?

Bubble's built-in rich text editor is limited. This plugin gives you:

- **Full formatting** — Bold, italic, underline, strikethrough, highlight, text color, font family, font size, subscript, superscript
- **Structure** — Headings (H1–H6), blockquotes, code blocks, horizontal rules, collapsible details/accordion sections
- **Lists** — Bullet, numbered, and task/checklist lists with indent/outdent
- **Tables** — Insert, resize, merge/split cells, toggle header rows and columns
- **Media** — Images (inline or block) and YouTube embeds
- **Links** — With custom styling and configurable protocols
- **Math** — LaTeX formulas inline or as blocks, edited from your own Bubble popup
- **Menus** — Top toolbar, bubble menu (on text selection), and floating menu
- **Real-time collaboration** — Via Tiptap Cloud, custom Hocuspocus server, or Liveblocks, with cursor labels, connection status, and JWT auth
- **Output formats** — HTML, plain text, and JSON — all exposed as Bubble states
- **55+ workflow actions** — Control the editor programmatically from Bubble workflows
- **Keyboard & Markdown shortcuts** — Standard editor shortcuts plus Markdown-style triggers
- **Fully customizable** — CSS overrides for every element, per-extension toggles, debug mode

---

## Fork & develop locally

Want to customize the plugin, add extensions, or contribute? Here's how to get your own copy running.

### 1. Fork the plugin in Bubble

Open the [plugin page](https://bubble.io/plugin/rich-text-editor-tiptapdev-1670612027178x122079323974008830) in Bubble and click **Fork**. This creates your own copy of the plugin under your Bubble account.

### 2. Get the plugin editor URL

Open your forked plugin in the Bubble plugin editor. Copy the URL from your browser's address bar — it will look something like:

```
https://bubble.io/plugin_editor?id=1234567890x987654321
```

### 3. Install Pled

[Pled](https://github.com/RicoTrevisan/pled) is a CLI that lets you pull Bubble plugin source code to local files, edit with any editor or AI agent, and push back.

Download the latest archive for your platform from the [Pled releases page](https://github.com/RicoTrevisan/pled/releases/latest):

| Platform | Archive |
|---|---|
| macOS (Apple Silicon) | `pled-macos-arm.tar.gz` |
| macOS (Intel) | `pled-macos-x86.tar.gz` |
| Linux (ARM) | `pled-linux-arm.tar.gz` |
| Linux (x86) | `pled-linux-x86.tar.gz` |
| Windows | `pled-windows.zip` |

Extract and move the `pled` binary to your PATH:

```bash
# Example for macOS Apple Silicon
tar -xzf pled-macos-arm.tar.gz
sudo mv pled /usr/local/bin/pled
```

See the [Pled repo](https://github.com/RicoTrevisan/pled) for full setup details.

### 4. Set your Bubble cookie

Pled authenticates with Bubble using your browser session cookie. Export it as an environment variable:

```bash
export BUBBLE_COOKIE="your_bubble_session_cookie_here"
```

To get your cookie: open the Bubble plugin editor → open browser DevTools → Application tab → Cookies → copy the full cookie string. See the [Pled README](https://github.com/RicoTrevisan/pled) for detailed instructions.

> **Tip:** Add the export to your shell profile (`~/.zshrc`, `~/.bashrc`, etc.) so it persists across sessions.

### 5. Clone this repo and initialize

```bash
git clone https://github.com/YOUR_USERNAME/tiptap.git
cd tiptap

# Point Pled at your forked plugin
pled init https://bubble.io/plugin_editor?id=YOUR_PLUGIN_ID

# Pull the latest plugin source from Bubble
pled pull
```

This decodes the plugin into editable JavaScript files under `src/`.

### 6. Make changes and push

Edit any file in `src/`, then push your changes back to Bubble:

```bash
pled push
```

Or use watch mode to auto-push on every save:

```bash
pled watch
```

That's it. Open your Bubble app, and the plugin reflects your changes.

---

## Project structure

```
src/
├── actions/                           # Server-side actions
│   ├── generate-auth-token-AEK/      # JWT auth token generation
│   └── convert-webhook-payload.../    # Hocuspocus webhook → HTML
├── elements/
│   └── tiptap-AAC/                    # Main editor element
│       ├── actions/                   # 55 element actions (bold, italic, tables, etc.)
│       ├── initialize.js              # Editor setup and configuration
│       ├── update.js                  # Property change handling
│       ├── preview.js                 # Bubble editor preview
│       └── reset.js                   # Teardown and cleanup
├── plugin.json                        # Plugin metadata and field definitions
└── shared.html                        # Shared HTML resources
lib/
├── index.js                           # Library imports → window.tiptap namespace
├── package.json                       # npm dependencies (Tiptap, Hocuspocus, etc.)
└── dist.js                            # Bundled output (uploaded to Bubble CDN)
```

---

## Collaboration authentication retries

Custom Hocuspocus and Tiptap Cloud allow **five total attempts**, not five retries:
initial connection plus retries after **1, 2, 4, and 8 seconds**. Retry teardown
preserves progress; successful authentication resets the consecutive-failure budget.

After the fifth failure, the provider, websocket, editor, and active document are
disposed, timers stop, `Collaboration status` becomes `failed`, and `Is ready` is
`no`. Ordinary Bubble updates (including cursor name/color changes) cannot restart
an exhausted connection. Changing credentials, provider/document/endpoint, or a
construction-time extension/menu configuration starts a fresh budget. Disabling
collaboration can still start a local editor. Raw authentication reasons are not
logged because providers may include credentials or document identifiers.

## Mathematics (LaTeX)

Turn on **Mathematics** (Extensions section). It is off by default; while it is
off, nothing changes and no math files are loaded.

- **Typing:** `$$x^2$$` becomes a formula inside the line. `$$$x^2$$$` on an
  empty line becomes a formula block. Single dollar signs stay text, so prices
  like `$5` are safe. Saved text is never converted when it loads.
- **Actions:** **Insert inline math** and **Insert block math** (LaTeX, without
  dollar signs) insert at the cursor. **Update math** (LaTeX) changes the selected
  formula, and **Delete math** deletes it. Both do nothing when no formula is
  selected.
- **Editing in your own popup:** clicking a formula in an editable editor selects
  it and fires **Math clicked**. **Selected math LaTeX** and **Selected math type**
  (`inline` or `block`) are set before the event, and follow the selection (click
  or arrow keys) the rest of the time. Pre-fill a popup input from Selected math
  LaTeX, then run Update math. In read-only mode a click does nothing.
- **Output:** formulas are stored as
  `<span data-type="inline-math" data-latex="…">…</span>` and
  `<div data-type="block-math" data-latex="…">…</div>`, with the LaTeX as the
  element's text. They load back into the editor; anywhere else (an HTML element,
  an email, **Convert webhook payload to HTML**) the LaTeX shows as text.
- **Invalid LaTeX** shows its source in red. It never stops saving.
- **Rendering:** KaTeX 0.16.29 and its fonts load from jsDelivr with SRI, only on
  pages with a Mathematics editor. Formulas show their LaTeX until KaTeX arrives,
  or if it's blocked.

## Library management

All Tiptap libraries are centralized in `lib/index.js`, bundled into a single file, and exposed on `window.tiptap` for use in `initialize.js` and `update.js`.

**To add a new library:**

1. Add the import to `lib/index.js` and expose it on `window.tiptap`
2. Bundle: `npm run build`
3. Upload: `pled upload dist.js`
4. Use the returned CDN URL in the element's `headers.html`
5. Access it in `initialize.js` / `update.js` via `window.tiptap`

---

## Commands

| Command | What it does |
|---|---|
| `pled pull` | Pull latest plugin source from Bubble |
| `pled push` | Push local changes to Bubble |
| `pled watch` | Auto-push on file save |
| `npm run build` | Bundle `lib/index.js` → `dist.js` |
| `pled upload dist.js` | Upload bundled libraries to Bubble CDN |

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for release history.

---

## License

This plugin is available on the [Bubble plugin marketplace](https://bubble.io/plugin/rich-text-editor-tiptapdev-1670612027178x122079323974008830). Fork and modify freely.

## Continuous integration

GitHub Actions runs `.github/workflows/ci.yml` on every pull request, pushes to
`main`, and manual dispatch. It uses the Node version in `.node-version` and the
locked dependencies in `lib/package-lock.json`. Run the same checks locally:

```sh
cd lib
npm ci
npm run validate:plugin
npm run test:validator
npm test
```

Plugin validation parses every `src/` JSON file and embedded server package
manifest, checks JavaScript as Bubble function bodies without executing it,
checks element action declarations against their files in both directions,
and checks literal `instance.publishState` / `instance.triggerEvent` names
against the owning element's metadata. It also checks required lifecycle and
server bodies and duplicate state/event names. Computed state/event names are
reported as unchecked; this is static validation, not full Bubble schema or
runtime validation. The validator's tests include invalid-source fixtures to
verify these checks fail when expected.

`npm test` builds `lib/dist.js` and runs the existing regression suite. CI needs
no Bubble credentials and does not upload bundles or push plugin changes.
The GitHub check is named **Build, tests, and plugin validation**; it can be
selected as a required check in the repository's branch protection settings.
