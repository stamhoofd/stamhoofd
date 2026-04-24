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
        await PrerenderEndpoint.fileCache.clear()
    })

    beforeEach(() => {
        nock.enableNetConnect();
    })

    test('Returns 200 when healthy', async () => {
        const request = Request.post({
            path: '/prerender',
            query: { 
                url: 'https://shop.stamhoofd.be/test/'
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
                url: 'https://shop.stamhoofd.be/test/'
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
                url: 'https://shop.stamhoofd.be/test/'
             },
        });

        await expect(testServer.test(endpoint, request)).rejects.toThrow(STExpect.simpleError({code: 'unavailable', statusCode: 503}))
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
                url: 'https://shop.stamhoofd.nl/test/'
             },
        });

        const response = await testServer.test(endpoint, request);
        expect(response.status).toBe(301);
        expect(response.headers).toEqual(expect.objectContaining({
            location: 'https://shop.stamhoofd.be/test/'
        }))
    });
});
