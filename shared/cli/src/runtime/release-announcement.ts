import { markdownToSlack } from './markdown-to-slack.js';
import { postSlackMessage } from './slack.js';
import type { SlackConfig, SlackMessage } from './slack.js';

/**
 * Slack renders a single message of at most 40,000 characters, but messages over ~4,000 are visually
 * truncated with a "show more". We keep each thread reply comfortably under that so the notes stay
 * readable, splitting longer notes across several replies on line boundaries.
 */
const MAX_REPLY_LENGTH = 3500;

/** A function that posts a Slack message and returns its `ts`. Injectable so tests can record calls. */
export type SlackPoster = (message: SlackMessage) => Promise<string>;

export type AnnounceReleaseOptions = {
    /** Version tag, e.g. "v2.124.0". */
    tag: string;
    /** Public URL of the GitHub release. Omitted when the repository is unknown. */
    releaseUrl?: string;
    /** The full release-notes body (English + Dutch), posted as thread replies. */
    notesBody: string;
    /** Override the poster (defaults to posting to Slack with the given config). */
    post?: SlackPoster;
};

/** The short root message that links to the release; the notes follow as thread replies. */
export function buildReleaseRootMessage(tag: string, releaseUrl?: string): string {
    const link = releaseUrl ? ` — <${releaseUrl}|Release notes>` : '';
    return `:rocket: *Stamhoofd ${tag} released*${link}`;
}

/**
 * Splits the notes into <= MAX_REPLY_LENGTH chunks, breaking on line boundaries so headings and list
 * items stay intact. A single line longer than the limit is hard-split as a last resort.
 */
export function chunkReleaseNotes(body: string, maxLength: number = MAX_REPLY_LENGTH): string[] {
    const chunks: string[] = [];
    let current = '';

    const flush = () => {
        if (current.length > 0) {
            chunks.push(current);
            current = '';
        }
    };

    for (const line of body.split('\n')) {
        if (line.length > maxLength) {
            flush();
            for (let i = 0; i < line.length; i += maxLength) {
                chunks.push(line.slice(i, i + maxLength));
            }
            continue;
        }
        if (current.length > 0 && current.length + 1 + line.length > maxLength) {
            flush();
        }
        current = current.length > 0 ? `${current}\n${line}` : line;
    }
    flush();

    return chunks;
}

/**
 * Posts a short root announcement for a published release, then the full release notes as threaded
 * replies. Returns the root message `ts` and how many reply messages were posted.
 */
export async function announceRelease(config: SlackConfig, options: AnnounceReleaseOptions): Promise<{ rootTs: string; replyCount: number }> {
    const post = options.post ?? (message => postSlackMessage(config, message));

    const rootTs = await post({ text: buildReleaseRootMessage(options.tag, options.releaseUrl) });

    // Convert the GitHub markdown to Slack mrkdwn so the notes render nicely instead of showing raw syntax.
    const replies = chunkReleaseNotes(markdownToSlack(options.notesBody).trim());
    for (const reply of replies) {
        await post({ text: reply, threadTs: rootTs });
    }

    return { rootTs, replyCount: replies.length };
}
