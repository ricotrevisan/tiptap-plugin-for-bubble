# Tiptap software factory

A scheduled loop on `lab` that takes this project's Linear tickets through fix, review and shipping, **one ticket at a time**. Agents do the work; the maintainer decides what's ready and what ships.

## The loop

| Linear | Who | What happens |
| --- | --- | --- |
| Backlog/Todo + `ready-for-agent` | Maintainer (triage) | The queue. Todo comes before Backlog, then Linear priority, then oldest. |
| In Progress | Fix session | Worktree + branch from `origin/main`, regression test first, fix, full gates, PR, independent review receipt + drummer review. |
| In Review | Maintainer | Reads the PR and the ticket's closing comment. Add **`ship-approved`** to ship, or comment to send it back. |
| In Review + `ship-approved` | Ship session | Guarded merge, `pled push` to the development version, check on `tiptap-demo`, baseline commit, Done, cleanup. |
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

Each dispatch writes `~/.t3/task-handoffs/tiptap-factory/<ticket>-<fix|ship>/`: the rendered prompt, the T3 thread receipt, and `factory.json`, which is the lock. It also comments on the ticket with the thread, branch and worktree. A ticket is never dispatched twice for the same kind. To redo one, delete its directory after checking its thread and worktree.

Sessions run as Claude Code, `claude-opus-5-5`, medium effort, full access (`[session.model]` in the policy).

## Scheduling

Install the timer on `lab` (runs `--dispatch` every 30 minutes):

```sh
cp factory/systemd/tiptap-factory.{service,timer} ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now tiptap-factory.timer
journalctl --user -u tiptap-factory.service -n 20     # decisions and errors
```

A failed dispatch exits non-zero and shows in the journal. If it failed after creating its handoff directory, the next run fails too, until that directory is inspected and removed. That's deliberate: never start duplicate work.

## Not yet automated

- **Triage/intake:** the maintainer labels tickets `ready-for-agent`. Forum requests aren't pulled in.
- **Watchdog:** `status` flags stalled sessions but nobody is notified. Check it, or look for tickets stuck In Progress.
- **Lookback:** no error telemetry exists for plugin users yet.
