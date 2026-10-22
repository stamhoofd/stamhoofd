#!/bin/bash
# WorktreeCreate hook: Claude Code calls this instead of its default `git worktree add`.
# Worktrees go in `<main checkout>-worktrees/<name>` by default, never inside the repository: nested
# checkouts break `pnpm clear`, the structures version bump and other scripts that glob the repo.
# Pick another folder with `git config [--global] stamhoofd.worktreesDir <path>`. Because the
# worktree sits outside the main checkout, Node no longer resolves packages from the main
# `node_modules`, so the hook runs `pnpm install` as well.
# Prints the worktree path as the last line of stdout; everything else goes to stderr.
set -euo pipefail

name=$(node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(JSON.parse(s).name ?? ""))')
if [ -z "$name" ]; then
    echo "WorktreeCreate: no worktree name in hook input" >&2
    exit 1
fi

common_dir=$(git -C "$CLAUDE_PROJECT_DIR" rev-parse --path-format=absolute --git-common-dir)
main_checkout=$(dirname "$common_dir")
parent=$(git -C "$main_checkout" config --type=path --get stamhoofd.worktreesDir || echo "${main_checkout}-worktrees")
mkdir -p "$parent"
parent=$(cd "$parent" && pwd -P)
worktree="$parent/$name"

if [ -e "$worktree" ]; then
    echo "WorktreeCreate: $worktree already exists" >&2
    exit 1
fi

branch="worktree-$name"
if git -C "$main_checkout" show-ref --verify --quiet "refs/heads/$branch"; then
    git -C "$main_checkout" worktree add "$worktree" "$branch" >&2
else
    git -C "$main_checkout" worktree add -b "$branch" "$worktree" HEAD >&2
fi

git -C "$worktree" config extensions.worktreeConfig true
git -C "$worktree" config --worktree commit.gpgsign false

if ! (cd "$worktree" && pnpm install --prefer-offline >&2); then
    echo "WorktreeCreate: pnpm install failed in $worktree; run it manually before using stam" >&2
fi

echo "$worktree"
