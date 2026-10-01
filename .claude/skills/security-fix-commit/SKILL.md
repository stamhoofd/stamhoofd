---
name: security-fix-commit
description: Commit security vulnerability fixes to the shared `security` branch of the private `fork` remote (one commit per vulnerability, 🔒 prefix, Linear reference) so a release can ship before the fix is published on `origin`. Use when the user asks to commit, push or release a security fix / vulnerability fix privately, to the fork, or types /security-fix-commit.
---

# Security fix commit

Security fixes are collected on the `security` branch of the private `fork` remote, released from
there, and published on the public `origin` remote later. Several agents may add to that branch
independently, without knowing about each other, so one release can contain multiple fixes. Every
push first rebases the branch onto the latest `origin/main`, so a release from it is never out of
date. The user releases it with `pnpm run ship:private` on a local `security` branch tracking
`fork/security`: version commit and tag go to the fork only, without npm or a GitHub release. Nothing about an unpublished vulnerability may reach a public place.

## Hard rules

- **Never push to `origin`** or any remote other than `fork`. Never run a bare `git push`, never
  set an upstream (`-u`), never use `gh pr create`, `gh stack` or GitHub issues for these changes.
- **Verify `fork` is private on GitHub immediately before every push** (step 1). If the check
  fails or is inconclusive, stop and tell the user. Do not push.
- Only push to `fork`'s `security` branch, never to its `main` or another branch. The rebase needs
  a force push: only ever use `--force-with-lease` with the exact SHA you rebased (step 7), never
  `--force`. Other agents' commits on `security` must never be lost.
- Don't post vulnerability details anywhere public (PR titles/descriptions, public issues, comments
  on public repos). Don't create or comment on Linear issues unless asked.
- Commit the fixes only on the local `security` branch (step 4), never on another branch: that may
  get pushed to `origin` later. Stay on `security` afterwards.
- Publishing on `origin` is a separate step (the `security-fix-publish` skill) that only happens
  when the user explicitly asks.

## 1. Verify the fork is private

```bash
slug() { echo "$1" | sed -E 's#^(git@github\.com:|ssh://git@github\.com/|https://github\.com/)##; s#\.git$##'; }
PUSH=$(slug "$(git remote get-url --push fork)")
FETCH=$(slug "$(git remote get-url fork)")
ORIGIN=$(slug "$(git remote get-url --push origin)")
echo "push=$PUSH fetch=$FETCH origin=$ORIGIN"
gh repo view "$PUSH" --json nameWithOwner,isPrivate,visibility
```

Continue only if `PUSH` equals `FETCH`, differs from `ORIGIN`, and `gh` reports
`"isPrivate":true` / `"visibility":"PRIVATE"` for it. Any other result (error, not logged in,
`PUBLIC`, `INTERNAL`): stop.

## 2. Split the changes per vulnerability

Identify each distinct vulnerability in the pending changes (uncommitted work, or local commits the
user points to). Every vulnerability gets exactly one commit containing its fix and its tests.
If it is unclear which change belongs to which vulnerability, ask.

For each vulnerability find the Linear issue: use the one the user mentioned, otherwise search
Linear (`list_issues` with a query). If none is found, ask the user whether there is one.

## 3. Verify the fixes

In the current worktree, before moving anything: every fix has a regression test that fails without
the fix and passes with it. Run lint, typecheck and the affected test packages as described in
`CLAUDE.md`. Then run `/self-review` on the changes and resolve its remarks.

## 4. Switch to `security`

```bash
git config extensions.worktreeConfig true
git config --worktree commit.gpgsign false
git fetch origin main
if git ls-remote --exit-code --heads fork security; then
  git fetch --no-tags fork +refs/heads/security:refs/remotes/fork/security
  LEASE=$(git rev-parse fork/security)
else
  LEASE=
fi
git show-ref --verify --quiet refs/heads/security && git log --oneline "${LEASE:-origin/main}"..security
```

- Decide on the remote branch (`ls-remote`), not on a local `fork/security` ref: that can be stale
  after the branch was deleted on the fork.
- `LEASE` is the remote tip (empty = the branch doesn't exist yet). Step 7 only overwrites the
  branch if it still points there.
- If the last command lists commits, the local `security` branch has unpushed work: stop and ask.

If the fixes are local commits, note their SHAs first. Then switch; uncommitted changes come along:

```bash
git switch -C security "${LEASE:-origin/main}"
git config branch.security.remote fork
git config branch.security.merge refs/heads/security
git config branch.security.pushRemote fork
git rev-parse --abbrev-ref --symbolic-full-name '@{push}'   # must print fork/security
```

The repo sets `remote.pushDefault=origin`, which overrides `branch.security.remote`: without
`pushRemote`, a bare `git push` on `security` goes to `origin`. If `@{push}` prints anything other
than `fork/security`, stop and tell the user. If the switch fails (conflicting local changes, or
`security` is checked out in another worktree), stop and ask.

## 5. One commit per vulnerability

Stage only that vulnerability's files (`git add -p` when a file touches several vulnerabilities) and
commit. For fixes that were local commits, `git cherry-pick <sha>` and rewrite the message. On a
non-mechanical conflict, stop and ask.

Commit message format (English, short, past tense like the existing 🔒 commits):

```
🔒 Fixed <what was vulnerable>

fixes STA-XXXX
```

Omit the `fixes` line only when there is no Linear issue. No other trailers.

`git status --porcelain` must be empty afterwards. If unrelated changes remain, stop and ask.

## 6. Rebase onto origin/main

```bash
git rebase origin/main
ONTO=$(git rev-parse HEAD~<number of your commits>)
git log --format='%h %s%n%b' "$ONTO"..HEAD   # only your commits, correct messages
git diff --stat "$ONTO"..HEAD                 # only the intended files
```

- The rebase drops commits that were already published on `origin/main`. Version commits from
  private releases (`vX.Y.Z`, `Increased structures to version N`) stay on the branch.
- A conflict in `lerna.json`, a `package.json` version or `Version.ts` usually means `main` was
  released while the fork had a private release, or a dependency bump landed next to a version line.
  Stop and ask; don't resolve it.
- On a conflict in another agent's commit: resolve it only if it is mechanical, and mention it in
  the report. Otherwise `git rebase --abort` and stop and ask.

## 7. Push to the fork

Re-run step 1, then:

```bash
git push --force-with-lease=refs/heads/security:"$LEASE" fork security:refs/heads/security
```

An empty `LEASE` makes the push fail if the branch was created in the meantime.

A rejected push means another agent pushed to (or created) `security` in the meantime. Rebuild the
branch from the new remote tip and reapply your commits:

```bash
OLD_ONTO=$ONTO OLD_HEAD=$(git rev-parse HEAD)
git fetch origin main
git fetch --no-tags fork +refs/heads/security:refs/remotes/fork/security
LEASE=$(git rev-parse fork/security)
git reset --hard "$LEASE"
git rebase origin/main
ONTO=$(git rev-parse HEAD)
git cherry-pick "$OLD_ONTO..$OLD_HEAD"
```

Only when the cherry-pick succeeded: rerun the step 6 checks and step 1, then push with the new
`LEASE`. Never push after a failed or partial cherry-pick: that would drop your own fixes (they stay
reachable as `$OLD_HEAD`). On a non-mechanical conflict, `git cherry-pick --abort` and stop and ask.
Never `--force`.

## 8. Report

Stay on `security`. Report to the user: the pushed commit SHAs and subjects, whether `security` was
created or rebased and added to, any rebase conflicts you resolved, and a reminder that the fix is
not public yet.
