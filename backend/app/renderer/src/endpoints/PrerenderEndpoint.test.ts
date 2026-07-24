import { Request, TestServer } from '@simonbackx/simple-endpoints';
import { PrerenderEndpoint } from './PrerenderEndpoint.js';
import nock from 'nock';
import { STExpect } from '@stamhoofd/test-utils';
import fs from 'fs/promises';

async function fileExists(path: string): Promise<boolean> {
    try {
        await fs.access(path, fs.constants.F_OK);
        return true;
    } catch {
        return false;
    }
}

describe('Endpoint.Prerender', () => {
    const endpoint = new PrerenderEndpoint();
    const testServer = new TestServer();

    beforeAll(async () => {
        await PrerenderEndpoint.fileCache.clear();
    });

    beforeEach(() => {
        nock.enableNetConnect();
    });

    test('Returns 200 when healthy', async () => {
        const request = Request.post({
            path: '/prerender',
            query: {
                url: 'https://shop.stamhoofd.be/test/',
            },
        });

        const response = await testServer.test(endpoint, request);
        expect(response.status).toBe(200);
        expect(typeof response.body).toBe('string');
        expect(response.body.startsWith('<!doctype html>')).toBe(true);
    });

    test('Uses cache', async () => {
        nock.disableNetConnect();

        const request = Request.post({
            path: '/prerender',
            query: {
                url: 'https://shop.stamhoofd.be/test/',
            },
        });

        const response = await testServer.test(endpoint, request);
        expect(response.status).toBe(200);
        expect(typeof response.body).toBe('string');
        expect(response.body.startsWith('<!doctype html>')).toBe(true);
    });

    test('Does not use stale cache', async () => {
        nock.disableNetConnect();

        const file = PrerenderEndpoint.fileCache.keyToFilePath('https://shop.stamhoofd.be/test/');
        const mtimeMs = Date.now() - 13 * 60 * 1000 * 60;
        await fs.utimes(file, mtimeMs / 1000, mtimeMs / 1000);

        const request = Request.post({
            path: '/prerender',
            query: {
                url: 'https://shop.stamhoofd.be/test/',
            },
        });

        await expect(testServer.test(endpoint, request)).rejects.toThrow(STExpect.simpleError({ code: 'unavailable', statusCode: 503 }));
    });

    test('Purges stale cache', async () => {
        nock.disableNetConnect();

        const file = PrerenderEndpoint.fileCache.keyToFilePath('https://shop.stamhoofd.be/test/');
        const mtimeMs = Date.now() - 13 * 60 * 1000 * 60;
        await fs.utimes(file, mtimeMs / 1000, mtimeMs / 1000);
        expect(await fileExists(file)).toEqual(true);

        await PrerenderEndpoint.fileCache.purgeCache(12 * 60 * 1000 * 60);

        expect(await fileExists(file)).toEqual(false);
    });

    test('Returns 301 when redirecting to different domain locale', async () => {
        const request = Request.post({
            path: '/prerender',
            query: {
                url: 'https://shop.stamhoofd.nl/test/',
            },
        });

        const response = await testServer.test(endpoint, request);
        expect(response.status).toBe(301);
        expect(response.headers).toEqual(expect.objectContaining({
            location: 'https://shop.stamhoofd.be/test',
        }));
    });

    describe('cleanHeaders', () => {
        test('Ignores the Content-Security-Policy header (the renderer sets its own via CORSMiddleware)', () => {
            // Caddy sets two CSP headers on documents; Puppeteer hands them back as one newline-joined
            // value. We never forward it (CORSMiddleware overwrites it anyway), so the crash-prone
            // header is dropped regardless of how Puppeteer joined it.
            const cleaned = PrerenderEndpoint.cleanHeaders({
                'content-security-policy': `script-src 'nonce-abc' 'strict-dynamic'; object-src 'none'; base-uri 'none'\nscript-src 'self' 'nonce-abc'`,
            });

            expect(cleaned).not.toHaveProperty('content-security-policy');
        });

        test('Ignores any header whose value contains a CR/LF (would throw ERR_INVALID_CHAR)', () => {
            const cleaned = PrerenderEndpoint.cleanHeaders({
                'x-newline': 'a\nb',
                'x-carriage-return': 'a\r\nb',
                'x-ok': 'clean',
            });

            expect(cleaned).not.toHaveProperty('x-newline');
            expect(cleaned).not.toHaveProperty('x-carriage-return');
            expect(cleaned['x-ok']).toBe('clean');
        });

        test('Lowercases keys and forwards other single-line headers unchanged', () => {
            const cleaned = PrerenderEndpoint.cleanHeaders({
                'Cache-Control': 'no-cache',
            });

            expect(cleaned['cache-control']).toBe('no-cache');
        });

        test('Drops hop-by-hop, set-cookie and empty headers', () => {
            const cleaned = PrerenderEndpoint.cleanHeaders({
                'connection': 'keep-alive',
                'transfer-encoding': 'chunked',
                'set-cookie': 'session=1',
                'content-length': '123',
                'x-empty': '',
            });

            expect(cleaned).toEqual({});
        });
    });
});
