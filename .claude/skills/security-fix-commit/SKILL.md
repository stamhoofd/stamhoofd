---
name: security-fix-commit
description: Commit security vulnerability fixes as pull requests against the `private` branch of the private `stamhoofd/stamhoofd-private` repository (git remote `private`; one commit per vulnerability, 🔒 prefix, Linear reference) so a release can ship before the fix is published on `origin`. Use when the user asks to commit, push or release a security fix / vulnerability fix privately, to the private repo, or types /security-fix-commit.
---

# Security fix commit

Security fixes are collected on the `private` branch of the private repository
`stamhoofd/stamhoofd-private` (git remote `private`), released from there, and published on the
public `origin` remote (`stamhoofd/stamhoofd`, branch `main`) later. Every fix arrives as a pull
request on the private repository, so one release can contain several fixes. The user releases by
rebasing `private` onto `main` and running `pnpm run ship:private` on it: version commit and tag go
to the private repository only, without npm or a GitHub release. Nothing about an unpublished
vulnerability may reach a public place.

## Hard rules

- **Never push to `origin`** or any remote other than `private`. Never run a bare `git push`: the
  repo sets `remote.pushDefault=origin`, so a bare push on a branch without `pushRemote` goes to
  the public repository. Never use `gh stack` or GitHub issues for these changes, and never run
  `gh pr create` without `--repo stamhoofd/stamhoofd-private`.
- **Verify the private repository is private on GitHub immediately before every push** (step 1).
  If the check fails or is inconclusive, stop and tell the user. Do not push.
- Only push your own fix branch (`security/<slug>`). Never push to the `private` or `main` branch
  of the private repository: the user owns `private` and rebases it for releases. Never `--force`
  (not even `--force-with-lease`) and never rewrite pushed commits; follow-ups are new commits.
- Don't post vulnerability details anywhere public (public PRs, issues, comments on public repos).
  Pull requests on `stamhoofd/stamhoofd-private` are fine. Don't create or comment on Linear
  issues unless asked.
- Commit the fixes only on a fix branch based on `private/private` (step 4), never on `main` or
  another branch that may get pushed to `origin` later. Stay on the fix branch afterwards.
- Don't merge the pull request; the user reviews and merges it. Publishing on `origin` is a
  separate step (the `security-fix-publish` skill) that only happens when the user explicitly asks.

## 0. Setup (once per clone)

`stam check` is going to configure this. Until then, if `git remote get-url private` fails:

```bash
git remote add private git@github.com:stamhoofd/stamhoofd-private.git
git fetch private
git branch --track private private/private    # skip if the local branch exists
git config branch.private.pushRemote private
git config branch.main.pushRemote origin
git config push.default current
```

## 1. Verify the private repository is private

```bash
slug() { echo "$1" | sed -E 's#^(git@github\.com:|ssh://git@github\.com/|https://github\.com/)##; s#\.git$##'; }
PUSH=$(slug "$(git remote get-url --push private)")
FETCH=$(slug "$(git remote get-url private)")
ORIGIN=$(slug "$(git remote get-url --push origin)")
echo "push=$PUSH fetch=$FETCH origin=$ORIGIN"
gh repo view "$PUSH" --json nameWithOwner,isPrivate,visibility
```

Continue only if `PUSH` equals `FETCH` and `stamhoofd/stamhoofd-private`, differs from `ORIGIN`,
and `gh` reports `"isPrivate":true` / `"visibility":"PRIVATE"` for it. Any other result (error,
not logged in, `PUBLIC`, `INTERNAL`): stop.

## 2. Split the changes per vulnerability

Identify each distinct vulnerability in the pending changes (uncommitted work, or local commits the
user points to). Every vulnerability gets exactly one commit containing its fix and its tests, in
its own pull request. If it is unclear which change belongs to which vulnerability, ask.

For each vulnerability find the Linear issue: use the one the user mentioned, otherwise search
Linear (`list_issues` with a query). If none is found, ask the user whether there is one.

## 3. Verify the fixes

In the current worktree, before moving anything: every fix has a regression test that fails without
the fix and passes with it. Run lint, typecheck and the affected test packages as described in
`CLAUDE.md`. Then run `/self-review` on the changes and resolve its remarks.

## 4. Create a fix branch from `private/private`

Pick a short lowercase slug per vulnerability, e.g. `security/sta-1234-webshop-token`.

```bash
git config extensions.worktreeConfig true
git config --worktree commit.gpgsign false
git fetch --no-tags private +refs/heads/private:refs/remotes/private/private
git show-ref --verify --quiet refs/heads/security/<slug> && echo "branch exists, pick another slug"
```

If the fixes are local commits, note their SHAs first. Then switch; uncommitted changes come along:

```bash
git switch -c security/<slug> private/private
git config branch.security/<slug>.remote private
git config branch.security/<slug>.merge refs/heads/security/<slug>
git config branch.security/<slug>.pushRemote private
git config branch.security/<slug>.pushRemote   # must print: private
```

- Base on `private/private`, not `origin/main`: the pull request targets `private`, which may be
  behind `main` or carry private release commits.
- `@{push}` cannot be resolved before the branch exists on the remote; the `pushRemote` value is
  the check. If it prints anything other than `private`, stop and tell the user.
- If the switch fails (conflicting local changes), stop and ask.

Several vulnerabilities: finish steps 5 and 6 for the first, then create the next branch from
`private/private` the same way; the remaining uncommitted changes come along. If two fixes touch the
same file or depend on each other, put them in one branch and one pull request with one commit
each, and tell the user to merge it with "Rebase and merge" so every vulnerability stays one commit.

## 5. One commit per vulnerability

Stage only that vulnerability's files (`git add -p` when a file touches several vulnerabilities) and
commit. For fixes that were local commits, `git cherry-pick <sha>` and rewrite the message. On a
non-mechanical conflict, stop and ask.

Commit message format (English, short, past tense like the existing 🔒 commits):

```
🔒 Fixed <what was vulnerable>

fixes STA-XXXX
```

Omit the `fixes` line only when there is no Linear issue. No other trailers. The 🔒 prefix and the
`fixes` line are only for the commit that fixes the vulnerability; a tests-only or other follow-up
commit gets a plain message (`Added Playwright tests for ...`).

`git status --porcelain` must be empty after the last vulnerability. If unrelated changes remain,
stop and ask.

## 6. Push and open the pull request

Re-run step 1, then:

```bash
git push private security/<slug>:refs/heads/security/<slug>
gh pr create --repo stamhoofd/stamhoofd-private --base private --head security/<slug> \
  --title '🔒 Fixed <what was vulnerable>' --body-file <file>
gh pr view --repo stamhoofd/stamhoofd-private security/<slug> --json url,baseRefName,headRefName
```

- Title: the commit subject. Body: the `fixes STA-XXXX` line plus what was vulnerable and how the
  fix closes it, in a few sentences; keep gotchas, no boilerplate.
- `baseRefName` must be `private` and the URL must be under `stamhoofd/stamhoofd-private`.
  Otherwise stop and tell the user.
- A rejected push means the branch already exists on the private repository: pick another slug,
  never `--force`. Follow-up commits to an open pull request go on the same branch and are pushed
  the same way.

## 7. Report

Stay on the fix branch. Report to the user: the pull request URLs with their commit SHAs and
subjects, the Linear issues, and a reminder that the fix is not public yet and that the pull request
still has to be merged into `private` before it can be released.
