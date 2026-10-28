import { Request, TestServer } from '@simonbackx/simple-endpoints';
import { signInternal } from '@stamhoofd/backend-env';
import { FileCache } from '../helpers/FileCache.js';
import { PdfCacheEndpoint } from './PdfCacheEndpoint.js';

/** Exercises request decoding and signature verification with cache I/O stubbed. */
describe('PDF cache authorization', () => {
    const endpoint = new PdfCacheEndpoint();
    const server = new TestServer();
    const cacheId = 'document-123';
    const timestamp = 2000;

    beforeEach(() => {
        vi.spyOn(FileCache, 'read').mockResolvedValue(Buffer.from('PDF'));
    });

    afterEach(() => vi.restoreAllMocks());

    /**
     * A grant authorizes only its signed cache ID and exact version while unexpired.
     * Mutating request fields after signing must fail without accessing cached bytes;
     * missing fields must also be rejected by request decoding.
     */
    test.each(['missing', 'expired', 'changed version', 'changed ID', 'invalid signature'])('rejects %s authorization before reading the cache', async (mode) => {
        const expires = Date.now() + (mode === 'expired' ? -1000 : 60000);
        const signature = signInternal('pdf-cache', cacheId, String(timestamp), String(expires));
        const query = {
            cacheId: mode === 'changed ID' ? 'invoice-123' : cacheId,
            timestamp: mode === 'changed version' ? timestamp + 1 : timestamp,
            ...(mode === 'missing' ? {} : { expires, signature: mode === 'invalid signature' ? 'invalid' : signature }),
        };
        await expect(server.test(endpoint, Request.get({ path: '/pdf-cache', query }))).rejects.toThrow();
        expect(FileCache.read).not.toHaveBeenCalled();
    });

    /** Valid grants work for both cache namespaces and pass the signed version to storage unchanged. */
    test.each(['document-123', 'invoice-123'])('returns an authorized exact version of %s', async (cacheId) => {
        const expires = Date.now() + 60000;
        const signature = signInternal('pdf-cache', cacheId, String(timestamp), String(expires));
        const response = await server.test(endpoint, Request.get({
            path: '/pdf-cache', query: { cacheId, timestamp, expires, signature },
        }));
        expect(response.body).toEqual(Buffer.from('PDF'));
        expect(FileCache.read).toHaveBeenCalledWith(cacheId, new Date(timestamp));
    });
});
