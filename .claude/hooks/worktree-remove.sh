#!/bin/bash
# WorktreeRemove hook, the counterpart of worktree-create.sh. Only removes worktrees that live in
# the configured worktrees folder so a wrong path can never delete anything else.
set -euo pipefail

worktree=$(node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(JSON.parse(s).worktree_path ?? ""))')
common_dir=$(git -C "$CLAUDE_PROJECT_DIR" rev-parse --path-format=absolute --git-common-dir)
main_checkout=$(dirname "$common_dir")
parent=$(git -C "$main_checkout" config --type=path --get stamhoofd.worktreesDir || echo "${main_checkout}-worktrees")
[ -d "$parent" ] && parent=$(cd "$parent" && pwd -P)

case "$worktree" in
    "$parent"/?*) ;;
    *)
        echo "WorktreeRemove: refusing to remove $worktree, it is not inside $parent" >&2
        exit 1
        ;;
esac

git -C "$main_checkout" worktree remove --force "$worktree" >&2 || rm -rf "$worktree"
git -C "$main_checkout" worktree prune >&2
