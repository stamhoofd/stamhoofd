#!/usr/bin/env bash
#
# Manages a single "incident" Slack thread for CI failures on main.
#
#   report-failure "<Job Label>"  -> if an incident is open, reply in its thread;
#                                    otherwise post a new root message and open one.
#   report-recovery               -> if an incident is open, post a ✅ reply, add a
#                                    ✅ reaction to the root message, and close it.
#
# Incident state lives in a small JSON object in DigitalOcean Spaces so it survives
# across workflow runs. Serialization of concurrent failing jobs is handled by the
# caller (a sequential `needs` chain in ci.yml), so this script does a plain
# read-modify-write.
#
# Required env: SLACK_BOT_TOKEN, SLACK_CHANNEL_ID, SPACES_CI_BUCKET, SPACES_CI_REGION,
#   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, HEAD_SHA, COMMIT_MSG, AUTHOR, RUN_URL.
# Optional env: TRACE_LINKS, GITHUB_RUN_ID,
#   STATE_KEY (default incidents/main.json), SLACK_API_BASE (default https://slack.com/api).

set -uo pipefail

ENDPOINT="https://${SPACES_CI_REGION}.digitaloceanspaces.com"
STATE_KEY="${STATE_KEY:-incidents/main.json}"
SLACK_API_BASE="${SLACK_API_BASE:-https://slack.com/api}"
SHORT_SHA="${HEAD_SHA:0:7}"

# Clickable commit reference (falls back to plain code if no URL is provided).
if [ -n "${COMMIT_URL:-}" ]; then
    COMMIT_REF="<${COMMIT_URL}|${SHORT_SHA}>"
else
    COMMIT_REF="\`${SHORT_SHA}\`"
fi

# GitHub run IDs increase with push order, so we use them to order runs: an older
# (lower) run must never resolve an incident whose newest failure is from a newer run.
RUN_ID_NUM="${GITHUB_RUN_ID:-0}"

# --- Slack helpers ---------------------------------------------------------

# slack_post_message <text> [thread_ts] -> prints the message ts on success.
slack_post_message() {
    local text="$1" thread="${2:-}" payload resp ok
    if [ -n "$thread" ]; then
        payload="$(jq -n --arg c "$SLACK_CHANNEL_ID" --arg t "$text" --arg th "$thread" \
            '{channel:$c, text:$t, thread_ts:$th}')"
    else
        payload="$(jq -n --arg c "$SLACK_CHANNEL_ID" --arg t "$text" \
            '{channel:$c, text:$t}')"
    fi
    resp="$(curl -sS -X POST "$SLACK_API_BASE/chat.postMessage" \
        -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
        -H 'Content-type: application/json; charset=utf-8' \
        --data "$payload")"
    ok="$(printf '%s' "$resp" | jq -r '.ok // false')"
    local msg_ts
    msg_ts="$(printf '%s' "$resp" | jq -r '.ts // empty')"
    if [ "$ok" != "true" ] || [ -z "$msg_ts" ]; then
        echo "Slack chat.postMessage failed: $resp" >&2
        return 1
    fi
    printf '%s' "$msg_ts"
}

# slack_add_reaction <message_ts> <emoji-name>
slack_add_reaction() {
    local ts="$1" name="$2" resp ok err
    resp="$(curl -sS -X POST "$SLACK_API_BASE/reactions.add" \
        -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
        -H 'Content-type: application/json; charset=utf-8' \
        --data "$(jq -n --arg c "$SLACK_CHANNEL_ID" --arg ts "$ts" --arg n "$name" \
            '{channel:$c, timestamp:$ts, name:$n}')")"
    ok="$(printf '%s' "$resp" | jq -r '.ok // false')"
    err="$(printf '%s' "$resp" | jq -r '.error // ""')"
    if [ "$ok" != "true" ] && [ "$err" != "already_reacted" ]; then
        echo "Slack reactions.add warning: $resp" >&2
    fi
}

# --- Incident state (Spaces) ----------------------------------------------

state_read() {
    aws s3 cp "s3://${SPACES_CI_BUCKET}/${STATE_KEY}" - --endpoint-url "$ENDPOINT" 2>/dev/null || true
}

state_write() {
    printf '%s' "$1" | aws s3 cp - "s3://${SPACES_CI_BUCKET}/${STATE_KEY}" \
        --endpoint-url "$ENDPOINT" --content-type application/json --only-show-errors
}

state_is_open() {
    printf '%s' "$1" | jq -e '.open == true' >/dev/null 2>&1
}

# --- Modes -----------------------------------------------------------------

mode="${1:-}"
case "$mode" in
    report-failure)
        label="${2:?job label required}"
        # Playwright trace links are stored in Spaces by publish-traces.sh and fetched
        # here — GitHub job outputs don't reliably propagate from a failed job.
        if [ -z "${TRACE_LINKS:-}" ] && [ -n "${TRACE_LINKS_KEY:-}" ]; then
            TRACE_LINKS="$(aws s3 cp "s3://${SPACES_CI_BUCKET}/${TRACE_LINKS_KEY}" - --endpoint-url "$ENDPOINT" 2>/dev/null || true)"
        fi
        state="$(state_read)"
        if state_is_open "$state"; then
            thread="$(printf '%s' "$state" | jq -r '.thread_ts')"
            text=":x: *${label}* failed — ${COMMIT_REF} (<${RUN_URL}|run>)"
            if [ -n "${TRACE_LINKS:-}" ]; then
                text="${text}"$'\n'"${TRACE_LINKS}"
            fi
            slack_post_message "$text" "$thread" >/dev/null
            # Record the newest failing run so an older green run can't falsely resolve us.
            stored_lfr="$(printf '%s' "$state" | jq -r '.last_failure_run_id // 0')"
            if [ "$RUN_ID_NUM" -gt "$stored_lfr" ]; then
                state_write "$(printf '%s' "$state" | jq --argjson r "$RUN_ID_NUM" '.last_failure_run_id = $r')"
            fi
            echo "Posted failure reply for '${label}' in thread ${thread}."
        else
            msg_first="$(printf '%s' "${COMMIT_MSG:-}" | head -n1)"
            text=":rotating_light: *CI failing on \`main\`* — *${label}* failed for \`${msg_first}\` by ${AUTHOR:-unknown}"$'\n'"${COMMIT_REF} · <${RUN_URL}|View run>"
            if [ -n "${TRACE_LINKS:-}" ]; then
                text="${text}"$'\n'"${TRACE_LINKS}"
            fi
            if ! ts="$(slack_post_message "$text" "")"; then
                echo "Failed to post root message; leaving incident state untouched." >&2
                exit 1
            fi
            new_state="$(jq -n \
                --arg ch "$SLACK_CHANNEL_ID" --arg ts "$ts" --arg sha "${HEAD_SHA:-}" \
                --arg run "${GITHUB_RUN_ID:-}" --arg at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
                --argjson lfr "$RUN_ID_NUM" \
                '{open:true, channel:$ch, thread_ts:$ts, head_sha:$sha, started_run_id:$run, last_failure_run_id:$lfr, started_at:$at}')"
            state_write "$new_state"
            echo "Opened incident (root ts ${ts}) for '${label}'."
        fi
        ;;
    report-recovery)
        state="$(state_read)"
        if state_is_open "$state"; then
            lfr="$(printf '%s' "$state" | jq -r '.last_failure_run_id // 0')"
            if [ "$RUN_ID_NUM" -lt "$lfr" ]; then
                echo "Recovery run ${RUN_ID_NUM} predates the latest failure (${lfr}); a newer commit is still failing. Leaving incident open."
            else
                thread="$(printf '%s' "$state" | jq -r '.thread_ts')"
                msg_first="$(printf '%s' "${COMMIT_MSG:-}" | head -n1)"
                text=":white_check_mark: *main is green again* on ${COMMIT_REF} — \`${msg_first}\`"
                slack_post_message "$text" "$thread" >/dev/null
                slack_add_reaction "$thread" "white_check_mark"
                state_write "$(printf '%s' "$state" | jq '.open=false')"
                echo "Resolved incident in thread ${thread}."
            fi
        else
            echo "No open incident; nothing to recover."
        fi
        ;;
    *)
        echo "Usage: slack-incident.sh report-failure <label> | report-recovery" >&2
        exit 2
        ;;
esac
