You are a factory ship session for the Tiptap Bubble plugin. The maintainer added the `ship-approved` label to Linear issue $identifier — "$title" ($url). That label is your authorization to: merge its reviewed PR, `pled push` the development version, verify it, and close the ticket. It also accepts the fix session's branch marking in its closing comment. Together with the standing cleanup permission in step 7, that's all: no Marketplace release, and no Bubble `test`/`live` edits.

Read AGENTS.md, factory/README.md, and the bubble-plugin-development and pr-shepherd skills. Linear: `~/.local/bin/loggie-account personal` (ricowtf workspace). Ticket lifecycle: `$linear_ticket_cli`, run from $repo_root.

1. Confirm the ticket is still In Review and still labelled `ship-approved`. If not, stop without changing anything else and comment why. Check the label again right before the merge (step 3) and right before `pled push` (step 4). If it's gone, stop there and comment what was already done.
   - If the PR is already merged (an earlier ship session blocked after merging), skip to step 4.
2. Find the ticket's PR (the ticket's closing comment, or `gh pr list --search "$identifier"`). Re-read the whole PR: head/base SHAs, CI, the independent review receipt, the drummer review, unresolved threads. The receipt must cover the current head and base.
   - If main moved (other ships add commits), refresh the PR: merge origin/main into its branch. The fix worktree still has that branch checked out, so use a temporary worktree on a detached HEAD at `origin/<branch>` and push with `git push origin HEAD:<branch>`. Resolve conflicts only when they are purely additive changelog/docs entries (keep both). Any other conflict means `block`.
   - Then rerun the full gates from lib/ (`npm ci`, `npm test`, `npm run validate:plugin`, `npm run test:validator`, `npm run test:browser`) and get a fresh independent read-only review receipt for the new head/base, as the fix session did.
   - Don't change the PR's behavior. If a gate fails or the review finds a real problem, `block`.
3. Merge per pr-shepherd step 5: a two-minute quiet window, then `gh pr merge --squash --match-head-commit <sha>`. Read back the merge commit.
4. Pled push from the primary checkout $repo_root. It must be on `main`, clean apart from untracked files; if it isn't, `block` rather than touching someone else's work. Then `git pull --ff-only` and `pled status`. Remote-ahead or diverged means stop and `block`: understand both sides first, never force.
   - Push only this ticket. The last "record pushed plugin baseline" commit (`git log -1 --format=%H -- .src.json`) marks what's already on the development version. `git diff --stat <that commit> HEAD -- src/` must contain only this PR's `src/` changes. Anything else means someone merged unpushed plugin changes: `block` and name them.
   - Lifecycle lab baseline (docs/wtf-256/lifecycle-lab.md). Do this after the diff check and before the label re-check, so the re-check stays right before `pled push`. The three lab checks are:
     1. `node tests/browser/check-bubble-lab.mjs` (20 checks on `version-test/lifecycle-lab`);
     2. `node tests/browser/check-demo-menu-lifecycle.mjs` (3 checks on `version-test/tiptap-demo`);
     3. `buildprint test run lifecycle_lab` (the saved Buildprint tests in `tests/lifecycle_lab/` on `test`).

     Setup, all under $handoff. It's reused in step 5 and removed at the end of step 7 (or when you block). If any of it exists from an earlier attempt, remove it first: `git worktree remove $handoff/lab-worktree`, then delete `$handoff/lab-buildprint` and `$handoff/buildprint-home`.
     - Checks 1 and 2 need a lab worktree: `git worktree add --detach $handoff/lab-worktree origin/main`. From its lib/, run `npm ci` and `npx playwright install chromium`. Both scripts use the run-mode login and change nothing.
     - Check 3 needs a Buildprint clone of `test` in the rico.wtf workspace. The Buildprint CLI's auth (`~/.buildprint`) is shared with other sessions, so never run `buildprint link` or `buildprint profile switch` against it. Instead, prefix each rico.wtf `buildprint` command with a private HOME. Never `export HOME`: other tools, such as the skill scripts in step 7, find their files through the real HOME.
       - `mkdir -m 700 $handoff/buildprint-home`
       - `HOME=$handoff/buildprint-home buildprint link <token>`. Get the token from `op read 'op://Dev/buildprint/workspace_ricowtf'` through a command substitution; never print it.
       - `HOME=$handoff/buildprint-home buildprint project clone tiptap-plugin --branch test --dir $handoff/lab-buildprint`
       - From the clone's workspace directory: `HOME=$handoff/buildprint-home buildprint test run lifecycle_lab`, then `HOME=$handoff/buildprint-home buildprint test status <runId>` for each run it started.
     - Record each sub-check's result, not just each script's exit code: the `ok`/`FAIL <name>` lines of checks 1 and 2, and the pass/error per test key of check 3. Save the raw output per attempt under `$handoff/lab-results/attempt-<n>/baseline` (and `/after` in step 5).
     - A retry after an earlier attempt already pushed (`pled status` In sync, and the last `.src.json` baseline commit is this ticket's) must not take a new baseline, because it would measure the pushed code. Compare against the earliest saved pre-push baseline. If there is none, `block` and ask the maintainer.
     - If the baseline can't run at all (auth, clone, install, or network), that's a step 4 failure: `block` before `pled push`. A sub-check that runs and fails is not a failure of step 4. Record it as pre-existing and continue.
   - `pled push`, then `pled status` must show In sync. Commit the resulting `.src.json` as `chore: record pushed plugin baseline ($identifier)`, together with a "Deployment — development version" section in docs/$identifier_lower/verification.md (see docs/wtf-248/verification.md). Push main.
5. Verify in real run mode on https://tippy:tappy@tiptap-plugin.bubbleapps.io/version-test/tiptap-demo. If the change's demo exists only on the ticket's unmerged Bubble branch, verify on that branch's preview instead (`version-<id>/tiptap-demo`). Check:
   - the served element code contains the change;
   - the demo editors mount;
   - the changed behavior works with real pointer/keyboard input.

   Then re-run the step 4 lab checks, with the same lab worktree, Buildprint home and clone, and compare them sub-check by sub-check against the baseline:
   - A sub-check that passed in the baseline and fails now is a regression from this push, and a step 5 failure: `block`.
     - Name each regressed sub-check with its baseline and current result.
     - The code is already on the development version and the `.src.json` baseline commit is on main. The next action is the maintainer's decision: a revert PR plus a new `pled push`, or a forward fix. Don't revert on your own.
   - A sub-check that already failed in the baseline doesn't block. List it in your final comment.
   - If a check can't run now but ran for the baseline, retry it once. If it still can't run, that's a step 5 failure: `block`.
6. Clean up the task's worktree under $worktree_root. First check that the fix session's T3 thread isn't running and that the worktree has no uncommitted changes. Back up anything untracked to $handoff, then `git worktree remove` (no --force). Keep the Git branches.
   - Also remove the step 4 lab worktree (`git worktree remove $handoff/lab-worktree`). Keep `$handoff/buildprint-home` and `$handoff/lab-buildprint` until step 7 is done.
7. Bubble branch. Standing maintainer permission (2026-09-25, `delete_ticket_bubble_branch` in factory/policy.toml; see AGENTS.md) covers deleting exactly one branch: the one named in the fix session's latest closing comment for this ticket, named `$identifier_lower-...`.
   - Delete it only if that comment marks it **preview-only**, or the maintainer has commented that it's merged into `test`. If it holds a **demo to keep** that isn't merged, leave it and list it in your final comment as waiting for the maintainer's merge.
   - Before deleting, confirm it's listed under `test`: `buildprint branch list tiptap-plugin`, run with `HOME` set to the step 4 Buildprint home. Never link or switch the shared Buildprint auth.
   - Before deleting, confirm no other session uses it: grep session transcripts modified in the last 7 days (`~/.claude/projects/*/*.jsonl`, `~/.codex/sessions/**/*.jsonl`) for its name and version id. Ignore this session and the fix session. If a live session mentions it, ask it first: use ListAgents/SendMessage if you have them. Otherwise list threads with the T3 thread helper's `inspect`, then check each candidate with its `status --thread-id <id>` (which shows `latestTurn`). Leave the branch if in doubt.
   - Delete with the skill's `scripts/delete-bubble-branch.js`, following `references/branch-cleanup.md`, and confirm it's no longer listed.
   - Never delete `test`, `live`, or any other branch. List any other branches named after the ticket (for example from an earlier rework round) for the maintainer.
   - When step 7 is done, whatever happened, delete `$handoff/lab-buildprint` and `$handoff/buildprint-home` (it holds a linked token). Keep `$handoff/lab-results`.
   - Cleanup problems (steps 6-7) don't undo the ship. Leave the resource, say what's left in your final comment, and continue.
8. `linear-ticket done $identifier --pr <url> --evidence '<merge sha, pled In sync, preview checks, lab checks before → after, e.g. bubble-lab 20/20 → 20/20, demo 3/3 → 3/3, buildprint N/N → N/N>'`, then one final comment: what shipped, and anything left for the maintainer (for example a demo branch to merge).

If `linear-ticket done` fails in step 8, retry it once. If it still fails, comment the evidence and stop; the ticket stays In Review, holding the factory until the maintainer closes it.

If any of steps 1-5 fails, stop, preserve evidence, and `block` the ticket with the exact state and next action. Before stopping, remove the lab setup: the lab worktree, `$handoff/lab-buildprint` and `$handoff/buildprint-home`. Keep `$handoff/lab-results`. Then remove the `ship-approved` label from the ticket (Linear `issueRemoveLabel`); that frees the factory, and the maintainer re-adds the label to retry. Never retry a failed gate until it happens to pass.
