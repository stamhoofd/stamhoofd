import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { FileCache } from './FileCache.js';

/** Exercises on-disk version selection without sharing cache entries with other tests. */
describe('FileCache exact versions', () => {
    const cacheId = `document-${randomUUID()}`;

    afterEach(async () => {
        await fs.rm(`${STAMHOOFD.CACHE_PATH}/${cacheId}`, { recursive: true, force: true });
    });

    /** An existing later timestamp is a cache miss, not a substitute for the requested document. */
    test('does not return a newer document for an older version', async () => {
        await FileCache.write(cacheId, new Date(2000), Buffer.from('newer document'));

        expect(await FileCache.read(cacheId, new Date(1000))).toBeNull();
    });

    /** Positive control: matching timestamps return the stored PDF bytes unchanged. */
    test('returns the exact requested version', async () => {
        const pdf = Buffer.from('requested document');
        await FileCache.write(cacheId, new Date(2000), pdf);

        expect(await FileCache.read(cacheId, new Date(2000))).toEqual(pdf);
    });
});
