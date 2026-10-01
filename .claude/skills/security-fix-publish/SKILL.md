---
name: security-fix-publish
description: Publish released security fixes from the private `fork` remote's `security` branch to `main` on the public `origin` remote, after verifying they were actually released, then publish those releases to npm and GitHub. Use when the user asks to publish, merge back or upstream security fixes, merge the fork's security branch into main, or types /security-fix-publish.
---

# Security fix publish

Security fixes are collected on the `security` branch of the private `fork` remote (see the
`security-fix-commit` skill). `pnpm run ship:private` on that branch makes a private release: it
pushes the version commit and tag to the fork only, without npm or a GitHub release. This skill
publishes the released fixes on `origin/main`, then completes those releases on npm and GitHub.

Publishing makes a vulnerability public, so **only commits contained in a release may be
published**. Commits on `security` that were not released stay private.

## Hard rules

- Publish only commits whose change is contained in a version tag (step 2). If nothing qualifies,
  stop.
- Get explicit confirmation from the user that the release is deployed (step 3) before anything is
  pushed to `origin`.
- Never push to `origin/main` directly; land the commits via a pull request with a rebase merge, so
  every vulnerability stays one commit.
- Push a release tag to `origin`, publish it to npm or create its GitHub release only after the PR
  is merged and everything in the tag is on `origin/main` (step 6).
- Never `--force` push; the only lease-protected push is the branch delete in step 7. Commits other
  agents added to `fork/security` after the release must never be lost or published.
- Never run a bare `git push` on the local `security` branch. `remote.pushDefault=origin` overrides
  its upstream; keep `git config branch.security.pushRemote fork` set (verify with
  `git rev-parse --abbrev-ref --symbolic-full-name 'security@{push}'` → `fork/security`).

## 1. Fetch the current state

```bash
git fetch origin main
git ls-remote --exit-code --heads fork security || echo "no security branch"
git fetch --no-tags fork +refs/heads/security:refs/remotes/fork/security
TIP=$(git rev-parse fork/security)
git log --oneline origin/main.."$TIP"
```

No `security` branch, or nothing in `origin/main..$TIP`: nothing to publish, stop. Use `$TIP`
(not `fork/security`) from here on: other agents may push to the branch while this skill runs.

## 2. Find what was released

A release is a `v*` version tag on the fork or on `origin`. `security` is rebased onto
`origin/main` before every new fix, so a tag usually holds older copies of the commits on `$TIP`,
with different SHAs and sometimes different context lines. So compare by content: a commit is
released when applying it onto the tag changes nothing. Tags that are ancestors of `origin/main`
only contain public code and are skipped. Fetch the tags into a separate namespace so private tags
don't end up in the local tag list.

```bash
git fetch --no-tags fork '+refs/tags/v*:refs/release-tags/fork/v*'
git fetch --no-tags origin '+refs/tags/v*:refs/release-tags/origin/v*'
OUT="$(mktemp -d)"; : > "$OUT/publish"; : > "$OUT/private"; : > "$OUT/tags"
for ref in $(git for-each-ref --format='%(refname)' refs/release-tags); do
  git merge-base --is-ancestor "$ref" origin/main || echo "$ref"
done > "$OUT/candidates"
for C in $(git rev-list --reverse origin/main.."$TIP"); do
  released=
  for ref in $(cat "$OUT/candidates"); do
    if [ "$(git merge-tree --write-tree --merge-base "$C^" "$ref" "$C" 2>/dev/null | head -1)" = "$(git rev-parse "$ref^{tree}")" ]; then
      released=$ref; break
    fi
  done
  if [ -n "$released" ]; then
    echo "$C" >> "$OUT/publish"
    echo "${released#refs/release-tags/} $(git log -1 --format=%ci "$released")" >> "$OUT/tags"
  else
    echo "$C" >> "$OUT/private"
  fi
done
sort -u -o "$OUT/tags" "$OUT/tags"
git for-each-ref --format='delete %(refname)' refs/release-tags | git update-ref --stdin
TAG=$(awk '{print $1}' "$OUT/tags" | sed 's#^[^/]*/##' | sort -rV | head -1)   # newest release
cat "$OUT/tags"
[ -s "$OUT/publish" ] && git log --no-walk=unsorted --format='publish %h %s' $(cat "$OUT/publish")
[ -s "$OUT/private" ] && git log --no-walk=unsorted --format='private %h %s' $(cat "$OUT/private")
```

- `$OUT/publish` empty: no release contains any security fix. Stop and tell the user.
- `$OUT/publish` also contains the release's version commits (`vX.Y.Z`, `Increased structures to
  version N`): they go to `main` too, so its version continues from the private release.
- `$OUT/private`: fixes added after the release. They stay private. A commit whose content differs
  from the released copy (e.g. after resolving a rebase conflict) also ends up here; if the user
  says one of them was released anyway, ask them to name the tag and verify it by hand before
  including it.

## 3. Confirm the release is deployed

A tag proves a release was cut, not that it runs in production. Show the user the tags and dates
from `$OUT/tags`, the commits to publish and the commits that stay private, and ask them to confirm
that those releases are deployed on every production environment. Stop unless they confirm. Skip the
question only if the user already said in this conversation that they are deployed.

## 4. Apply the released commits onto origin/main

Only the released commits, in their order on `security`:

```bash
WT="$(mktemp -d)/security-publish"
git worktree add --detach "$WT" origin/main
git -C "$WT" config extensions.worktreeConfig true
git -C "$WT" config --worktree commit.gpgsign false
git -C "$WT" cherry-pick $(cat "$OUT/publish")
git -C "$WT" log --format='%h %s%n%b' origin/main..HEAD
```

Every commit must be a 🔒 commit or a version commit from `$OUT/publish`. Anything else: stop and
ask. On a non-mechanical conflict, stop and ask.

## 5. Open the pull request and merge

```bash
git -C "$WT" push origin HEAD:refs/heads/security/$TAG
gh pr create -R stamhoofd/stamhoofd --base main --head "security/$TAG" \
  --title "🔒 Security fixes released in $TAG" --body "<one line per commit: subject + fixes STA-XXXX>"
gh pr checks <number> -R stamhoofd/stamhoofd --watch
gh pr merge <number> -R stamhoofd/stamhoofd --rebase --delete-branch
```

Required checks failing: report the failure and stop; don't merge. Never use `--squash` (it
collapses the vulnerabilities into one commit) or `--admin`.

## 6. Publish the releases to npm and GitHub

This is what `pnpm run ship:private` skipped. Handle each fork-only release tag, oldest first, so
the newest one ends up as npm `latest` and as the latest GitHub release. Run from the repository
root (`stam` needs the built CLI; run `pnpm run build:shared` first if it fails).

```bash
git fetch origin main
for T in $(awk '$1 ~ /^fork\//{sub("^fork/", "", $1); print $1}' "$OUT/tags" | sort -V); do
  git ls-remote --exit-code --tags origin "refs/tags/$T" >/dev/null && continue   # already public
  git fetch --no-tags fork "+refs/tags/$T:refs/tags/$T"
  [ "$(git merge-tree --write-tree origin/main "$T" | head -1)" = "$(git rev-parse 'origin/main^{tree}')" ] \
    || { echo "$T contains changes that are not on origin/main"; break; }
  git push origin "refs/tags/$T"
  NPM_WT="$(mktemp -d)/npm-publish"
  git worktree add --detach "$NPM_WT" "$T"
  (cd "$NPM_WT" && pnpm install --frozen-lockfile && pnpm run build:shared) || break
  OTP=$(op item get NPM --otp) && [ -n "$OTP" ] || { echo "no npm one-time password"; break; }
  (cd "$NPM_WT" && pnpm exec lerna publish from-git --yes --no-private --otp "$OTP") || break
  git worktree remove --force "$NPM_WT"
  pnpm run stam release publish --tag "$T" || break
done
```

- The `merge-tree` check must pass: pushing a tag makes all of its code public, so everything in it
  must already be on `origin/main`. If it fails, stop and ask; don't push that tag.
- `lerna publish from-git` publishes the packages tagged on `HEAD`, so it runs in a worktree at the
  tag. The one-time password is fetched right before it because it expires within 30 seconds; `op`
  may ask the user to unlock 1Password. Without a password, stop and ask the user to publish.
- `stam release publish` creates the GitHub release on `origin` and announces it in Slack, like
  `pnpm run ship` does for public releases.
- On any failure: stop, report which tags were done, and leave the rest. Rerunning this step skips
  tags that are already on `origin`; for a tag pushed but not yet on npm or GitHub, run the two
  publish commands for it by hand.

## 7. Clean up the fork

Delete `fork/security` only if everything on it was published, so that the next fix starts from
`origin/main`. The lease makes the delete fail if another agent pushed in the meantime:

```bash
[ ! -s "$OUT/private" ] && git push --force-with-lease=refs/heads/security:"$TIP" fork :refs/heads/security
git worktree remove "$WT"
```

If commits stay private or the delete is rejected, leave the branch. The `security-fix-commit`
skill drops the published commits from it the next time it rebases onto `origin/main`.

Report: the release tags, the merged PR, the npm and GitHub releases, the published commits, the
commits that stay private on `fork/security`, and whether the branch was deleted.
