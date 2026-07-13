---
name: self-review
description: Spin up a dedicated review sub-agent to critique Claude's own pending changes or recent commits, following the adjustable methodology in this skill. Use when the user asks to review your changes, review the diff, review the last commit(s), do a self-review, or types /self-review. Optional argument = the scope to review (e.g. a commit ref, a range, "last 2 commits", "staged").
---

# Self-review

Delegate a critical review of the current changes to a **fresh sub-agent**, so the
review isn't biased by the context that produced the code, then report its findings
back to the user.

## 1. Determine the review scope

Use the argument passed to the skill if there is one. Otherwise auto-detect, in this order:

1. **Uncommitted work** — if `git status --porcelain` is non-empty, review the working
   tree: staged + unstaged + untracked. Reproduce it with `git diff HEAD` and list
   untracked files via `git status --porcelain`.
2. **Branch commits** — otherwise review commits on this branch that aren't on `main`:
   `git log --oneline main..HEAD` and `git diff main...HEAD`.

## 2. Spawn the review sub-agent

Do **not** review the code yourself in the main thread — the whole point is a fresh pair of eyes. Launch **one** sub-agent with the Agent tool (`subagent_type: general-purpose`,
description like "Review current diff"). Its prompt must contain:

- The exact scope you resolved (the git command(s) that reproduce the diff, or the branch/range).
- This instruction, verbatim:
  > Read `.claude/skills/self-review/methodology.md` and follow it exactly. Review **only**
  > the changes in the scope below. Do not modify any files.
- The scope details.

## 3. Relay the findings

Summarize the sub-agent's report for the user: lead with the verdict and any blocking
issues, then the rest grouped by severity, keeping `file:line` references clickable.
Don't silently drop findings. Offer to fix them, but don't start fixing unless asked.
