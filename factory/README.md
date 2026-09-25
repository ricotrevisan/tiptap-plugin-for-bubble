# Tiptap software factory

A scheduled loop on `lab` that takes this project's Linear tickets through fix, review and shipping, **one ticket at a time**. Agents do the work; the maintainer decides what's ready and what ships.

## The loop

| Linear | Who | What happens |
| --- | --- | --- |
| Backlog/Todo + `ready-for-agent` | Maintainer (triage) | The queue. Todo comes before Backlog, then Linear priority, then oldest. Tickets blocked by an open ticket, or assigned to anyone except the Linear API user (the maintainer's own account), are skipped. To keep a ticket out, use `ready-for-human` or remove `ready-for-agent`. |
| In Progress | Fix session | Worktree + branch from `origin/main`, regression test first, fix, full gates, PR, independent review receipt + drummer review. |
| In Review | Maintainer | Reads the PR and the ticket's closing comment. Add **`ship-approved`** to ship. To send it back, comment what to change and move the ticket to Todo: the next run starts a rework session on the same branch and PR. |
| In Review + `ship-approved` | Ship session | Refreshes the PR if main moved (re-gated and re-reviewed), guarded merge, `pled push` of only this ticket, check on `tiptap-demo`, baseline commit, Done, removes the worktree. |
| Anything blocked | Maintainer | Sessions post one comment with the exact blocker and stop. The WTF team has no Blocked state, so the ticket keeps its state and keeps holding the factory until someone acts. |

The factory never releases to the Marketplace, edits Bubble `test`/`live`, or picks up tickets labelled `ready-for-human`, `requires-subscription`, `needs-info`, `needs-triage`, `wontfix` or `security`. Rules live in [`policy.toml`](policy.toml). The session instructions are [`prompts/fix.md`](prompts/fix.md) and [`prompts/ship.md`](prompts/ship.md).

## Why one at a time

The development version (`pled push`), the `tiptap-plugin` dev app's data and Bubble's nine branch slots under `test` are shared. A dispatched session holds the factory until its ticket reaches In Review (fix) or Done (ship). A ticket In Progress outside the factory also holds it. New fixes also wait while three tickets sit in In Review, so review doesn't pile up.

## Running it

From the primary checkout (`/home/rico/bubble-plugins/tiptap-plugin-for-bubble`, on `main`):

```sh
python3 factory/factory_next.py              # what would happen next (no writes)
python3 factory/factory_next.py --dispatch   # start that session now
python3 factory/factory_next.py status       # factory sessions; "stalled" = holds the factory, idle ≥ 6 h
touch ~/.t3/task-handoffs/tiptap-factory/PAUSE   # stop dispatching (rm to resume)
```

Each dispatch writes `~/.t3/task-handoffs/tiptap-factory/<ticket>-<fix|ship>/`: `factory.json` (the lock), the rendered prompt and the T3 thread receipt. It also comments on the ticket with the thread, branch and worktree.

- `factory.json` is written before anything else happens. If a dispatch dies partway, its status stays `starting` and the whole factory stays stopped. Check whether the T3 thread started and whether the worktree exists, then either fix `factory.json` or delete the directory.
- A fix is dispatched once per ticket, plus once per rework round (earlier receipts are kept as `factory.1.json`, …).
- A ship is dispatched once per approval. A ship session that blocks removes `ship-approved` itself. Once the factory has seen the label gone, adding it again ships again.
- The factory records that a fix reached In Review on its next run (every 30 minutes, even while paused). If a ticket goes to review and back to Todo between two runs, the factory can't see it was reviewed and stays busy; set `"reachedReview": true` in its `factory.json`.

Sessions run as Claude Code, `claude-opus-5-5`, medium effort, full access (`[session.model]` in the policy).

## Scheduling

Install the timer on `lab` (runs `--dispatch` every 30 minutes):

```sh
cp factory/systemd/tiptap-factory.{service,timer} ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now tiptap-factory.timer
journalctl --user -u tiptap-factory.service -n 20     # decisions and errors
```

Every run (including dry runs and paused runs) reads Linear and the local T3 server; if either is down, the run fails and dispatches nothing. A failed dispatch exits non-zero and shows in the journal. Its `starting` receipt keeps every later run reporting "busy … unfinished dispatch" until someone inspects it. That's deliberate: never start duplicate work.

## What's left for the maintainer

- **Branches:** the factory keeps Git branches. After a ticket is Done, its ship session deletes the Bubble branch the fix session created for that ticket (standing permission, `delete_ticket_bubble_branch` in the policy). It deletes nothing else; other stale branches are yours (Bubble allows nine under `test`).
- **Blocked tickets:** the WTF team has no Blocked state. A blocked session comments the exact blocker and stops, and its ticket keeps holding the factory. Resolve it, then move the ticket on (or back to Todo for a rework round).

## Not yet automated

- **Triage/intake:** the maintainer labels tickets `ready-for-agent`. Forum requests aren't pulled in.
- **Watchdog:** `status` flags stalled sessions but nobody is notified. Check it, or look for tickets stuck In Progress.
- **Lookback:** no error telemetry exists for plugin users yet.
