import { read1PasswordCli } from './one-password.js';

/** Slack credentials needed to post into a channel. */
export type SlackConfig = {
    /** Bot token with the chat:write scope. */
    token: string;
    /** Channel ID (e.g. C0XXXXXXX) the bot is a member of. */
    channel: string;
};

/** A message to post: the text, and an optional thread to reply into. */
export type SlackMessage = {
    text: string;
    /** When set, the message is posted as a reply in this thread instead of a new root message. */
    threadTs?: string;
};

/** 1Password references for the release announcement credentials, matching the OpenAI/token convention. */
const SLACK_TOKEN_1PASSWORD_REF = 'op://DevOps Development/Slack/token';
const SLACK_CHANNEL_1PASSWORD_REF = 'op://DevOps Development/Slack/development channel id';

/** Base URL of the Slack Web API. Overridable via SLACK_API_BASE so tests can point it elsewhere. */
function slackApiBase(): string {
    return process.env.SLACK_API_BASE ?? 'https://slack.com/api';
}

/**
 * Posts a message with chat.postMessage and returns its `ts` (timestamp id), which can be passed
 * back as `threadTs` to reply in the same thread. Throws when Slack reports a failure.
 */
export async function postSlackMessage(config: SlackConfig, message: SlackMessage): Promise<string> {
    const payload: Record<string, unknown> = { channel: config.channel, text: message.text };
    if (message.threadTs) {
        payload.thread_ts = message.threadTs;
    }

    const response = await fetch(`${slackApiBase()}/chat.postMessage`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${config.token}`,
            'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify(payload),
    });

    const body = await response.json() as { ok?: boolean; ts?: string; error?: string };
    if (body.ok !== true || !body.ts) {
        throw new Error(`Slack chat.postMessage failed: ${body.error ?? `HTTP ${response.status}`}`);
    }
    return body.ts;
}

/** Either ready-to-use Slack credentials, or a reason they are unavailable so the caller can skip. */
export type SlackConfigResolution
    = | { config: SlackConfig }
        | { unavailable: string };

/**
 * Resolves the Slack bot token and channel id, preferring environment overrides and falling back to
 * 1Password. Returns `{ unavailable }` (rather than throwing) when either is missing, so a release
 * can still be published without an announcement.
 */
export async function resolveSlackConfig(): Promise<SlackConfigResolution> {
    const token = process.env.SLACK_RELEASE_BOT_TOKEN ?? await read1PasswordCli(SLACK_TOKEN_1PASSWORD_REF, { optional: true });
    if (!token) {
        return { unavailable: `no Slack bot token (set SLACK_RELEASE_BOT_TOKEN or ${SLACK_TOKEN_1PASSWORD_REF})` };
    }

    const channel = process.env.SLACK_RELEASE_CHANNEL_ID ?? await read1PasswordCli(SLACK_CHANNEL_1PASSWORD_REF, { optional: true });
    if (!channel) {
        return { unavailable: `no Slack channel id (set SLACK_RELEASE_CHANNEL_ID or ${SLACK_CHANNEL_1PASSWORD_REF})` };
    }

    return { config: { token, channel } };
}
