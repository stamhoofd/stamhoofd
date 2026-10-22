#!/bin/bash
# Prepares cloud sessions so `pnpm stam test` works. Each step fixes a known failure:
#  - pnpm 12 leaves a shebang-less placeholder at ~/.local/share/pnpm/.tools/pnpm/<v>/bin/pnpm
#    when its native binary isn't installed. Turbo cannot spawn it ("Exec format error").
#  - `rsync` is used by package build scripts (exit 127 when missing).
#  - `pnpm stam test` starts MySQL through Docker, which needs a running dockerd.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
    exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

if ! command -v rsync >/dev/null 2>&1; then
    apt-get update -qq && apt-get install -y -qq rsync
fi

pnpm install

for dir in "$HOME"/.local/share/pnpm/.tools/pnpm/*/node_modules/pnpm; do
    if [ -f "$dir/install.js" ] && [ "$(head -c 4 "$dir/pnpm" 2>/dev/null)" != $'\x7fELF' ]; then
        (cd "$dir" && node install.js)
    fi
done

if command -v dockerd >/dev/null 2>&1 && ! docker info >/dev/null 2>&1; then
    (nohup dockerd >/tmp/dockerd.log 2>&1 &)
    for _ in $(seq 1 30); do
        docker info >/dev/null 2>&1 && break
        sleep 1
    done
fi
