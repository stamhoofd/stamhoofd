import { describe, expect, it } from 'vitest';
import { announceRelease, buildReleaseRootMessage, chunkReleaseNotes } from './release-announcement.js';
import type { SlackMessage } from './slack.js';

const config = { token: 'xoxb-test', channel: 'C123' };

describe('buildReleaseRootMessage', () => {
    it('links to the release when a url is given', () => {
        expect(buildReleaseRootMessage('v2.124.0', 'https://github.com/x/y/releases/tag/v2.124.0'))
            .toBe(':rocket: *Stamhoofd v2.124.0 released* — <https://github.com/x/y/releases/tag/v2.124.0|Release notes>');
    });

    it('omits the link when no url is available', () => {
        expect(buildReleaseRootMessage('v2.124.0')).toBe(':rocket: *Stamhoofd v2.124.0 released*');
    });
});

describe('chunkReleaseNotes', () => {
    it('returns a single chunk when the body fits', () => {
        expect(chunkReleaseNotes('one\ntwo', 100)).toEqual(['one\ntwo']);
    });

    it('splits on line boundaries without exceeding the limit', () => {
        const chunks = chunkReleaseNotes('aaaa\nbbbb\ncccc', 9);
        expect(chunks).toEqual(['aaaa\nbbbb', 'cccc']);
        expect(chunks.every(chunk => chunk.length <= 9)).toBe(true);
    });

    it('hard-splits a single line longer than the limit', () => {
        expect(chunkReleaseNotes('abcdefgh', 3)).toEqual(['abc', 'def', 'gh']);
    });

    it('returns nothing for an empty body', () => {
        expect(chunkReleaseNotes('')).toEqual([]);
    });
});

describe('announceRelease', () => {
    it('posts the root message first, then the notes as thread replies', async () => {
        const calls: SlackMessage[] = [];
        let counter = 0;
        const post = async (message: SlackMessage) => {
            calls.push(message);
            return `ts-${counter++}`;
        };

        const result = await announceRelease(config, {
            tag: 'v2.124.0',
            releaseUrl: 'https://github.com/x/y/releases/tag/v2.124.0',
            notesBody: 'line one\nline two',
            post,
        });

        expect(result).toEqual({ rootTs: 'ts-0', replyCount: 1 });
        expect(calls[0]).toEqual({ text: buildReleaseRootMessage('v2.124.0', 'https://github.com/x/y/releases/tag/v2.124.0') });
        expect(calls[1]).toEqual({ text: 'line one\nline two', threadTs: 'ts-0' });
    });

    it('converts the notes from markdown to Slack mrkdwn before posting', async () => {
        const calls: SlackMessage[] = [];
        const post = async (message: SlackMessage) => {
            calls.push(message);
            return 'root-ts';
        };

        await announceRelease(config, {
            tag: 'v1.0.0',
            notesBody: '### 🐛 Bug fixes\n- Fixed [it](https://x)',
            post,
        });

        expect(calls[1]).toEqual({ text: '*🐛 Bug fixes*\n• Fixed <https://x|it>', threadTs: 'root-ts' });
    });

    it('trims the notes and posts every chunk into the root thread', async () => {
        const calls: SlackMessage[] = [];
        const post = async (message: SlackMessage) => {
            calls.push(message);
            return 'root-ts';
        };

        // Many lines, each well under the limit, so the only splits happen on line boundaries.
        const lines = Array.from({ length: 20 }, (_, i) => `${i}: ${'x'.repeat(300)}`);
        const longNotes = `\n\n${lines.join('\n')}\n\n`;
        const result = await announceRelease(config, { tag: 'v1.0.0', notesBody: longNotes, post });

        expect(result.replyCount).toBeGreaterThan(1);
        const replies = calls.slice(1);
        expect(replies.every(reply => reply.threadTs === 'root-ts')).toBe(true);
        expect(replies.every(reply => reply.text.length <= 3500)).toBe(true);
        // Splitting on line boundaries keeps the notes intact when the replies are rejoined,
        // and the surrounding blank lines are trimmed away.
        expect(replies.map(reply => reply.text).join('\n')).toBe(longNotes.trim());
    });
});
