import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { CrlCache } from '../src/CrlCache.js';
import { StubRevocationHttpClient } from './helpers/RevocationFixtures.js';

const FIRST_URL = 'http://crl.example.com/first.crl';
const SECOND_URL = 'http://crl.example.com/second.crl';
const NOW = new Date('2026-11-04T12:00:00Z');
const AN_HOUR_IN_MS = 60 * 60 * 1000;

function setNow(date: Date) {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['Date'] }).setSystemTime(date);
}

/** The cache never parses what it keeps, so any bytes stand in for a list here. */
function list(url: string) {
    return new TextEncoder().encode(url);
}

describe('the cache of revocation lists', () => {
    let cache: CrlCache;
    let client: StubRevocationHttpClient;

    async function keep(url: string, expiresAt: Date) {
        const fetched = await cache.fetch(url, client);
        cache.store(url, fetched, expiresAt);
    }

    beforeEach(() => {
        cache = new CrlCache();
        client = new StubRevocationHttpClient()
            .answer(FIRST_URL, list(FIRST_URL))
            .answer(SECOND_URL, list(SECOND_URL));
        setNow(NOW);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    test('drops a list that expired rather than handing it out', async () => {
        await keep(FIRST_URL, new Date(NOW.getTime() + AN_HOUR_IN_MS));

        setNow(new Date(NOW.getTime() + 2 * AN_HOUR_IN_MS));
        await cache.fetch(FIRST_URL, client);

        expect(cache.size).toBe(0);
        expect(client.calls).toEqual([`GET ${FIRST_URL}`, `GET ${FIRST_URL}`]);
    });

    test('drops a list nobody asks for again, rather than keeping it until the process ends', async () => {
        await keep(FIRST_URL, new Date(NOW.getTime() + AN_HOUR_IN_MS));

        setNow(new Date(NOW.getTime() + 2 * AN_HOUR_IN_MS));
        await keep(SECOND_URL, new Date(NOW.getTime() + 3 * AN_HOUR_IN_MS));

        expect(cache.size).toBe(1);
    });
});
