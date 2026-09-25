# Tiptap plugin for Bubble

Use the **bubble-plugin-development** skill for the shared workflow (Pled, code piles, lib releases, Buildprint branching, verifying against the real Bubble UI).

Plugin-specific facts:

- Two code piles: `src/` — decoded Bubble plugin source (Pled uploads this); `lib/` — bundled Tiptap runtime and lifecycle tests.
- From `lib/`: `npm ci && npm test` — builds `lib/dist.js`, then runs lifecycle tests.
- When runtime dependencies or `lib/index.js` change, release the rebuilt bundle: unique versioned filename, `pled upload`, update `src/elements/tiptap-AAC/headers.html` to the new CDN URL, then `pled push`.
- Dev app: `tiptap-plugin` uses the plugin development version (Testing). Plugin changes immediately update this app; refresh the app/editor when needed to expose new fields.
- Run-mode login (not a real secret): **tippy** / **tappy**
- Demo page: `tiptap-demo` — one page, each demo is a reusable — `https://tippy:tappy@tiptap-plugin.bubbleapps.io/version-test/tiptap-demo`
- The demo page uses that development plugin version. It shows off the plugin in simple user-facing language, assuming a medior Bubble developer.
- In every Bubble editor element, always set **File uploads enabled** to an explicit option (`yes` or `no`); never leave it empty.

## Software factory

Tickets labelled `ready-for-agent` are worked one at a time by scheduled T3 sessions, and `ship-approved` ships them. Rules and commands are in `factory/README.md` and `factory/policy.toml`. A factory session follows the prompt it was given, which limits what it may do. Standing permissions recorded in `factory/policy.toml` are the maintainer's authorization for exactly the resources they name. For example, a ship session deleting its own ticket's preview-only Bubble branch counts as the immediate confirmation the bubble-plugin-development skill requires, provided the session derives and checks the exact branch at run time.

## Agent skills

### Issue tracker

Issues live in the ricowtf Linear workspace, in the Tiptap project. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the five existing WTF team triage labels. See `docs/agents/triage-labels.md`.

### Domain docs

Use a single root context and root ADR directory. See `docs/agents/domain.md`.
