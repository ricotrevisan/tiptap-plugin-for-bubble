# WTF-261: deployment — development version (2026-09-25)

- PR #47 was squash-merged as `f7a1aa7` and pushed to the development version outside the factory, so no baseline commit was recorded at the time.
- Before recording one, Pled reported **Diverged**. The remote plugin was pulled into a throwaway worktree and compared with `main` (`e34578c`):
  - `AAC.json` is semantically identical; only the key order differs.
  - The only other difference is an empty `actions` object in `toc_element.json`. WTF-250 recorded the same serialization quirk.
  - So the remote held nothing that `main` lacked.
- `pled push --force` from `main` completed, and `pled status` reports **In sync**. This commit records the resulting `.src.json` baseline, so the factory's "only this PR's src changes" check starts clean.
- The mention-created demo workflow on `tiptap-demo` is still to be built.
