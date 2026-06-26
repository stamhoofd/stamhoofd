import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { read1PasswordCli } from './one-password.js';
import { postSlackMessage, resolveSlackConfig } from './slack.js';

vi.mock('./one-password.js', () => ({
    read1PasswordCli: vi.fn(async () => ''),
}));

const config = { token: 'xoxb-test', channel: 'C123' };

function mockFetch(body: unknown, status = 200) {
    const fetchMock = vi.fn((_url: string, _init: RequestInit) => Promise.resolve(new Response(JSON.stringify(body), { status })));
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
}

afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    delete process.env.SLACK_RELEASE_BOT_TOKEN;
    delete process.env.SLACK_RELEASE_CHANNEL_ID;
    delete process.env.SLACK_API_BASE;
});

describe('postSlackMessage', () => {
    it('posts a root message and returns its ts', async () => {
        const fetchMock = mockFetch({ ok: true, ts: '111.222' });

        const ts = await postSlackMessage(config, { text: 'hello' });

        expect(ts).toBe('111.222');
        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe('https://slack.com/api/chat.postMessage');
        expect((init.headers as Record<string, string>).Authorization).toBe('Bearer xoxb-test');
        expect(JSON.parse(init.body as string)).toEqual({ channel: 'C123', text: 'hello' });
    });

    it('includes thread_ts when replying in a thread', async () => {
        const fetchMock = mockFetch({ ok: true, ts: '333.444' });

        await postSlackMessage(config, { text: 'in thread', threadTs: '111.222' });

        const [, init] = fetchMock.mock.calls[0];
        expect(JSON.parse(init.body as string)).toEqual({ channel: 'C123', text: 'in thread', thread_ts: '111.222' });
    });

    it('honours SLACK_API_BASE', async () => {
        process.env.SLACK_API_BASE = 'https://slack.test/api';
        const fetchMock = mockFetch({ ok: true, ts: '1' });

        await postSlackMessage(config, { text: 'hi' });

        expect(fetchMock.mock.calls[0][0]).toBe('https://slack.test/api/chat.postMessage');
    });

    it('throws with the Slack error when the response is not ok', async () => {
        mockFetch({ ok: false, error: 'not_in_channel' });

        await expect(postSlackMessage(config, { text: 'hi' })).rejects.toThrow('not_in_channel');
    });
});

describe('resolveSlackConfig', () => {
    beforeEach(() => {
        vi.mocked(read1PasswordCli).mockResolvedValue('');
    });

    it('prefers environment overrides over 1Password', async () => {
        process.env.SLACK_RELEASE_BOT_TOKEN = 'xoxb-env';
        process.env.SLACK_RELEASE_CHANNEL_ID = 'C-env';

        const result = await resolveSlackConfig();

        expect(result).toEqual({ config: { token: 'xoxb-env', channel: 'C-env' } });
        expect(read1PasswordCli).not.toHaveBeenCalled();
    });

    it('falls back to 1Password for both values', async () => {
        vi.mocked(read1PasswordCli).mockImplementation(async (ref: string) =>
            ref.endsWith('/token') ? 'xoxb-1p' : 'C-1p');

        const result = await resolveSlackConfig();

        expect(result).toEqual({ config: { token: 'xoxb-1p', channel: 'C-1p' } });
        expect(read1PasswordCli).toHaveBeenCalledTimes(2);
    });

    it('reports unavailable when the token is missing', async () => {
        const result = await resolveSlackConfig();
        expect(result).toHaveProperty('unavailable');
        expect('unavailable' in result && result.unavailable).toContain('token');
    });

    it('reports unavailable when only the channel is missing', async () => {
        process.env.SLACK_RELEASE_BOT_TOKEN = 'xoxb-env';
        const result = await resolveSlackConfig();
        expect('unavailable' in result && result.unavailable).toContain('channel');
    });
});
