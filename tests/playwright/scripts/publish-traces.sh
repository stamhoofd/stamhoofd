#!/usr/bin/env bash
#
# Uploads Playwright trace.zip files (produced on test failure) to a private
# DigitalOcean Spaces bucket, generates a presigned URL (7-day expiry) per trace,
# and renders deep links into trace.playwright.dev for both:
#   - Slack  -> "$RUNNER_TEMP/slack-payload.json"  (used on pushes to main)
#   - GitHub -> "$RUNNER_TEMP/pr-comment.md"        (posted as a PR comment)
#
# Intended to run from the tests/playwright directory in CI on a Playwright failure.
# It ALWAYS writes both files and exits 0, so the notification still fires even when
# there are no traces or the upload fails (e.g. missing creds on a fork PR).
#
# Required env (when traces exist): AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY,
#   SPACES_CI_BUCKET, SPACES_CI_REGION.
# Optional env: HEAD_COMMIT_MESSAGE, AUTHOR, COMMIT_URL, RUN_URL,
#   GITHUB_RUN_ID, GITHUB_RUN_ATTEMPT, RUNNER_TEMP, GITHUB_OUTPUT.

set -uo pipefail

: "${RUNNER_TEMP:=/tmp}"
SLACK_FILE="${RUNNER_TEMP}/slack-payload.json"
PR_FILE="${RUNNER_TEMP}/pr-comment.md"
BUCKET="${SPACES_CI_BUCKET:-}"
REGION="${SPACES_CI_REGION:-}"
ENDPOINT="https://${REGION}.digitaloceanspaces.com"
RUN_ID="${GITHUB_RUN_ID:-local}"
RUN_ATTEMPT="${GITHUB_RUN_ATTEMPT:-1}"
COMMIT_MSG="${HEAD_COMMIT_MESSAGE:-(unknown commit)}"
AUTHOR="${AUTHOR:-unknown}"
COMMIT_URL="${COMMIT_URL:-}"
RUN_URL="${RUN_URL:-}"
MAX_LINKS=20

header_text="@channel *Playwright tests failed* for \`${COMMIT_MSG}\` by ${AUTHOR}"

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

# --- Slack payload (one section block per trace; presigned URLs are too long to concatenate) ---
trace_blocks="[]"
if [ -n "$fallback" ]; then
    trace_blocks="$(jq -n --arg t "_${fallback}_" '[{type:"section", text:{type:"mrkdwn", text:$t}}]')"
else
    i=0
    while [ "$i" -lt "${#viewers[@]}" ]; do
        block="$(jq -n --arg label "${labels[$i]}" --arg url "${viewers[$i]}" \
            '{type:"section", text:{type:"mrkdwn", text:("🔍 <" + $url + "|" + $label + ">")}}')"
        trace_blocks="$(jq -c --argjson b "$block" '. + [$b]' <<<"$trace_blocks")"
        i=$((i + 1))
    done
fi

jq -n \
    --arg header "$header_text" \
    --arg commit_url "$COMMIT_URL" \
    --arg run_url "$RUN_URL" \
    --arg note "$note" \
    --argjson traceblocks "$trace_blocks" \
    '{
        text: "Playwright tests failed",
        blocks: (
            [ ( {type:"section", text:{type:"mrkdwn", text:$header}}
                + (if $commit_url != "" then
                    {accessory:{type:"button", text:{type:"plain_text", text:"Open commit", emoji:false}, url:$commit_url, action_id:"button-action"}}
                  else {} end) ) ]
            + $traceblocks
            + (if $note != "" then [ {type:"context", elements:[{type:"mrkdwn", text:("_" + $note + "_")}]} ] else [] end)
            + (if $run_url != "" then [ {type:"section", text:{type:"mrkdwn", text:("<" + $run_url + "|View workflow run & full HTML report>")}} ] else [] end)
        )
    }' > "$SLACK_FILE"

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

echo "Wrote Slack payload to $SLACK_FILE"
echo "Wrote PR comment to $PR_FILE"
{
    echo "slack_payload_path=${SLACK_FILE}"
    echo "pr_comment_path=${PR_FILE}"
} >> "${GITHUB_OUTPUT:-/dev/null}"

exit 0
