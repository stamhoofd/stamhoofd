#!/bin/bash
# Reminds the agent of the commit message conventions right before it runs `git commit`.
# The text is read from contributing/development-guidelines.md so it never drifts from the source.
set -euo pipefail

command=$(node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(JSON.parse(s).tool_input?.command ?? ""))')

if ! grep -qE '(^|[^[:alnum:]_-])git( +-C +[^ ]+)? +commit([^[:alnum:]-]|$)' <<<"$command"; then
    exit 0
fi

guidelines="$CLAUDE_PROJECT_DIR/contributing/development-guidelines.md"

# Print the "Use clear commit messages" and "Don't create merge commits" sections
sections=$(awk '
    /^#### / { keep = ($0 ~ /Use clear commit messages/ || $0 ~ /create merge commits/) }
    keep
' "$guidelines")

node -e '
process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
        hookEventName: "PreToolUse",
        additionalContext: "Before committing, check the message against the commit guidelines from contributing/development-guidelines.md. In particular: only prefix an emoji when the change is user-facing (it feeds the release notes), and then only one of the listed emojis.\n\n" + process.argv[1],
    },
}));
' "$sections"
