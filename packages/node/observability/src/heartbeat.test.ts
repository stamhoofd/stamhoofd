import { afterEach, expect, it, vi } from 'vitest';
import { sendSuccessHeartbeat } from './heartbeat.js';

const url = 'https://example.invalid/private-token';
afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

it('sends only a bodyless HTTPS GET and does not follow redirects', async () => {
    const request = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', request);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await sendSuccessHeartbeat(undefined);
    expect(request).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    await sendSuccessHeartbeat(url);
    expect(request).toHaveBeenCalledExactlyOnceWith(url, {
        method: 'GET',
        redirect: 'error',
        signal: expect.any(AbortSignal),
    });
    expect(warn).not.toHaveBeenCalled();
    await sendSuccessHeartbeat(url.replace('https:', 'http:'));
    expect(request).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledExactlyOnceWith('Completion heartbeat could not be delivered.');
});

it('bounds stalled delivery and discards response bodies and transport error details', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const request = vi
        .fn()
        .mockResolvedValueOnce(new Response('private upstream response', { status: 503 }))
        .mockImplementationOnce(
            (_url, { signal }: RequestInit) =>
                new Promise((_resolve, reject) =>
                    signal!.addEventListener('abort', () => reject(new Error(url))),
                ),
        );
    vi.stubGlobal('fetch', request);
    await sendSuccessHeartbeat(url);
    await sendSuccessHeartbeat(url);
    expect(request).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls).toEqual([
        ['Completion heartbeat could not be delivered.'],
        ['Completion heartbeat could not be delivered.'],
    ]);
}, 5000);
