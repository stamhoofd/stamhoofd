---
name: security-fix-publish
description: Publish released security fixes from the `private` branch of the private `stamhoofd/stamhoofd-private` repository (git remote `private`) to `main` on the public `origin` remote, after verifying they were actually released, then publish those releases to npm and GitHub. Use when the user asks to publish, merge back or upstream security fixes, publish the private branch to main, or types /security-fix-publish.
---

# Security fix publish

Security fixes are merged into the `private` branch of the private repository
`stamhoofd/stamhoofd-private` (git remote `private`; see the `security-fix-commit` skill). The
user rebases that branch onto `main` and runs `pnpm run ship:private` on it to make a private
release: version commit and tag go to the private repository only, without npm or a GitHub release.
This skill publishes the released fixes on `origin/main`, then completes those releases on npm and
GitHub.

Publishing makes a vulnerability public, so **only commits contained in a release may be
published**. Commits on `private` that were not released stay private.

## Hard rules

- Publish only commits whose change is contained in a version tag (step 2). If nothing qualifies,
  stop.
- Get explicit confirmation from the user that the release is deployed (step 3) before anything is
  pushed to `origin`.
- Push the commits straight to `origin/main` as a fast-forward (step 5): no pull request, no merge
  commit, so every vulnerability stays one commit.
- Push a release tag to `origin`, publish it to npm or create its GitHub release only after the
  commits are on `origin/main` and everything in the tag is there (step 6).
- Never push to the private repository from this skill: the user owns its `private` branch and
  rebases it before the next release. Never `--force` push anywhere, never run a bare `git push`.

## 1. Fetch the current state

```bash
git fetch origin main
git fetch --no-tags private +refs/heads/private:refs/remotes/private/private
TIP=$(git rev-parse private/private)
git log --oneline origin/main.."$TIP"
```

Nothing in `origin/main..$TIP`: nothing to publish, stop. Use `$TIP` (not `private/private`) from
here on: pull requests may be merged into the branch while this skill runs.

## 2. Find what was released

A release is a `v*` version tag on the private repository or on `origin`. `private` is rebased
onto `main` before every release, so an older tag holds copies of the commits on `$TIP` with
different SHAs and sometimes different context lines. So compare by content: a commit is released
when applying it onto the tag changes nothing. Tags that are ancestors of `origin/main` only
contain public code and are skipped. Fetch the tags into a separate namespace so private tags don't
end up in the local tag list.

```bash
git fetch --no-tags private '+refs/tags/v*:refs/release-tags/private/v*'
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
- `$OUT/private`: fixes merged after the release. They stay private. A commit whose content differs
  from the released copy (e.g. after resolving a rebase conflict) also ends up here; if the user
  says one of them was released anyway, ask them to name the tag and verify it by hand before
  including it. The check also misfires when a later commit on `private` touched the same lines:
  `git range-diff origin/main..<tag> origin/main..$TIP` is authoritative, an `=` row means released.

## 3. Confirm the release is deployed

A tag proves a release was cut, not that it runs in production. Show the user the tags and dates
from `$OUT/tags`, the commits to publish and the commits that stay private, and ask them to confirm
that those releases are deployed on every production environment. Stop unless they confirm. Skip the
question only if the user already said in this conversation that they are deployed.

## 4. Put the released commits on top of origin/main

When `private` was rebased onto the current `origin/main` and only unreleased commits follow the
release, `origin/main` can simply fast-forward to the last released commit, keeping the exact SHAs
and tag. Otherwise cherry-pick the released commits, in their order on `private`:

```bash
LAST=$(tail -1 "$OUT/publish"); WT=
if git merge-base --is-ancestor origin/main "$LAST" && [ -z "$(git rev-list origin/main.."$LAST" | grep -vxFf "$OUT/publish")" ]; then
  PUSH_REF=$LAST
else
  WT="$(mktemp -d)/security-publish"
  git worktree add --detach "$WT" origin/main
  git -C "$WT" config extensions.worktreeConfig true
  git -C "$WT" config --worktree commit.gpgsign false
  git -C "$WT" cherry-pick $(cat "$OUT/publish")
  PUSH_REF=$(git -C "$WT" rev-parse HEAD)
fi
git log --format='%h %s%n%b' origin/main.."$PUSH_REF"
```

Every commit must be a 🔒 commit, a follow-up to one (e.g. its Playwright tests) or a version
commit, and all of them must come from `$OUT/publish`. Anything else: stop and ask. On a
non-mechanical cherry-pick conflict, stop and ask.

## 5. Push to origin/main

The fixes were already reviewed and released, so they go to `main` directly, without a pull
request:

```bash
git push origin "$PUSH_REF":refs/heads/main
```

Rejected as non-fast-forward: `origin/main` moved in the meantime. Run `git fetch origin main`,
remove `$WT` if it exists and redo step 4 (it then takes the cherry-pick path). Never `--force`.

## 6. Publish the releases to npm and GitHub

This is what `pnpm run ship:private` skipped. Handle each private-only release tag, oldest first, so
the newest one ends up as npm `latest` and as the latest GitHub release. Run from the repository
root (`stam` needs the built CLI; run `pnpm run build:shared` first if it fails).

```bash
git fetch origin main
for T in $(awk '$1 ~ /^private\//{sub("^private/", "", $1); print $1}' "$OUT/tags" | sort -V); do
  git ls-remote --exit-code --tags origin "refs/tags/$T" >/dev/null && continue   # already public
  git fetch --no-tags private "+refs/tags/${T}:refs/tags/${T}"   # braces: zsh reads `$T:r` as a modifier
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
- `stam release publish` creates the GitHub release on `origin` (it reads the `origin` URL) and
  announces it in Slack, like `pnpm run ship` does for public releases.
- On any failure: stop, report which tags were done, and leave the rest. Rerunning this step skips
  tags that are already on `origin`; for a tag pushed but not yet on npm or GitHub, run the two
  publish commands for it by hand.

## 7. Clean up

```bash
[ -n "$WT" ] && git worktree remove "$WT"
```

Leave the private repository alone: `private` keeps its commits, and the user's next
`git rebase main` on it drops the ones that are now on `origin/main` (also after a cherry-pick, since
the content is identical).

Report: the release tags, the npm and GitHub releases, the commits pushed to `origin/main` and
whether they were fast-forwarded or cherry-picked, and the commits that stay private on `private`.
