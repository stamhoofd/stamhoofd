#!/usr/bin/env bash
#
# Uploads Playwright trace.zip files (produced on test failure) to a private
# DigitalOcean Spaces bucket, generates a presigned URL (7-day expiry) per trace,
# and renders deep links into trace.playwright.dev. It produces:
#   - "$RUNNER_TEMP/pr-comment.md"  -> posted as a PR comment (pull_request runs)
#   - s3://<bucket>/traces/<run>/<attempt>/slack-links.txt -> rendered Slack-mrkdwn
#       links fetched by the incident notifier on pushes to main (capped at 10)
#
# Intended to run from the tests/playwright directory in CI on a Playwright failure.
# It ALWAYS writes pr-comment.md and exits 0, so notification still fires even when
# there are no traces or the upload fails (e.g. missing creds on a fork PR).
#
# Required env (when traces exist): AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY,
#   SPACES_CI_BUCKET, SPACES_CI_REGION.
# Optional env: RUN_URL, GITHUB_RUN_ID, GITHUB_RUN_ATTEMPT, RUNNER_TEMP.

set -uo pipefail

: "${RUNNER_TEMP:=/tmp}"
PR_FILE="${RUNNER_TEMP}/pr-comment.md"
BUCKET="${SPACES_CI_BUCKET:-}"
REGION="${SPACES_CI_REGION:-}"
ENDPOINT="https://${REGION}.digitaloceanspaces.com"
RUN_ID="${GITHUB_RUN_ID:-local}"
RUN_ATTEMPT="${GITHUB_RUN_ATTEMPT:-1}"
RUN_URL="${RUN_URL:-}"
MAX_LINKS=20
SLACK_MAX=10

# Collect trace files (avoid mapfile so this also runs on bash 3.2 / macOS).
traces=()
while IFS= read -r line; do
    [ -n "$line" ] && traces+=("$line")
done < <(find test-results -name 'trace.zip' 2>/dev/null | sort)

labels=()
viewers=()
note=""
fallback=""

if [ "${#traces[@]}" -eq 0 ]; then
    fallback="No trace files were generated for this run — see the workflow run artifacts."
elif [ -z "$BUCKET" ] || [ -z "$REGION" ] || [ -z "${AWS_ACCESS_KEY_ID:-}" ] || [ -z "${AWS_SECRET_ACCESS_KEY:-}" ]; then
    fallback="${#traces[@]} trace file(s) found but Spaces credentials are not configured — see the workflow run artifacts."
else
    count=0
    for t in "${traces[@]}"; do
        if [ "$count" -ge "$MAX_LINKS" ]; then
            note="Showing first ${MAX_LINKS} of ${#traces[@]} traces. See the run artifacts for the rest."
            break
        fi
        label="$(basename "$(dirname "$t")")"
        key="traces/${RUN_ID}/${RUN_ATTEMPT}/$(printf '%02d' "$count")-${label}.zip"

        if ! aws s3 cp "$t" "s3://${BUCKET}/${key}" --endpoint-url "$ENDPOINT" --only-show-errors; then
            echo "Warning: failed to upload $t" >&2
            continue
        fi
        presigned="$(aws s3 presign "s3://${BUCKET}/${key}" --expires-in 604800 --endpoint-url "$ENDPOINT")"
        if [ -z "$presigned" ]; then
            echo "Warning: failed to presign $key" >&2
            continue
        fi

        # Presigned URLs contain & and = which would break the ?trace= query string, so url-encode.
        encoded="$(jq -rn --arg u "$presigned" '$u|@uri')"
        labels+=("${label//|/-}")
        viewers+=("https://trace.playwright.dev/?trace=${encoded}")
        count=$((count + 1))
    done

    if [ "${#viewers[@]}" -eq 0 ]; then
        fallback="Trace upload failed — see the workflow run artifacts."
    fi
fi

# --- PR comment (GitHub markdown) ---
{
    # Hidden marker so the comment can be updated in place on later runs.
    echo "<!-- playwright-traces -->"
    echo "### ❌ Playwright tests failed"
    echo ""
    if [ -n "$fallback" ]; then
        echo "$fallback"
    else
        echo "Open the failing traces in the [Playwright Trace Viewer](https://trace.playwright.dev) (links valid for 7 days):"
        echo ""
        i=0
        while [ "$i" -lt "${#viewers[@]}" ]; do
            echo "- 🔍 [${labels[$i]}](${viewers[$i]})"
            i=$((i + 1))
        done
        [ -n "$note" ] && { echo ""; echo "_${note}_"; }
    fi
    if [ -n "$RUN_URL" ]; then
        echo ""
        echo "[View workflow run & full HTML report](${RUN_URL})"
    fi
} > "$PR_FILE"

# --- Slack trace links ---
# Render the Slack-mrkdwn links once and upload them to Spaces at a deterministic
# key. The incident notifier is a SEPARATE job and fetches this object rather than
# reading a GitHub job output, which does not reliably propagate from a failed job.
# Capped at SLACK_MAX; presigned URLs are url-encoded after ?trace=.
LINKS_FILE="${RUNNER_TEMP}/slack-links.txt"
{
    if [ -n "$fallback" ]; then
        echo "_${fallback}_"
    else
        i=0
        while [ "$i" -lt "${#viewers[@]}" ] && [ "$i" -lt "$SLACK_MAX" ]; do
            echo "🔍 <${viewers[$i]}|${labels[$i]}>"
            i=$((i + 1))
        done
        if [ "${#viewers[@]}" -gt "$SLACK_MAX" ]; then
            echo "_…and $(( ${#viewers[@]} - SLACK_MAX )) more — see the run artifacts._"
        fi
    fi
} > "$LINKS_FILE"

if [ -n "$BUCKET" ] && [ -n "$REGION" ] && [ -n "${AWS_ACCESS_KEY_ID:-}" ] && [ -n "${AWS_SECRET_ACCESS_KEY:-}" ]; then
    aws s3 cp "$LINKS_FILE" "s3://${BUCKET}/traces/${RUN_ID}/${RUN_ATTEMPT}/slack-links.txt" \
        --endpoint-url "$ENDPOINT" --content-type 'text/plain; charset=utf-8' --only-show-errors \
        || echo "Warning: failed to upload slack-links.txt" >&2
fi

echo "Wrote PR comment to $PR_FILE"
echo "Wrote Slack trace links to $LINKS_FILE"

exit 0
