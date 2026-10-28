import { Request } from '@simonbackx/simple-endpoints';
import { signInternal } from '@stamhoofd/backend-env';
import { promises as fs } from 'node:fs';
import type { IncomingMessage } from 'node:http';
import { Readable } from 'node:stream';
import { HtmlToPdfEndpoint } from './HtmlToPdfEndpoint.js';
import { FileCache } from '../helpers/FileCache.js';

// Observe real Formidable file paths, including partial uploads on parse errors.
const uploads = vi.hoisted(() => [] as string[]);
vi.mock('formidable', async (importOriginal) => {
    const original = await importOriginal<typeof import('formidable')>();
    return {
        ...original,
        default: (...args: Parameters<typeof original.formidable>) => {
            const form = original.formidable(...args);
            form.on('fileBegin', (_name, file) => uploads.push(file.filepath));
            return form;
        },
    };
});

/** Uses real multipart parsing and disk uploads, but no browser or persistent PDF cache. */
describe('HTML PDF multipart cleanup', () => {
    const endpoint = new HtmlToPdfEndpoint();
    const html = '<html>Document</html>';
    const cacheId = 'document-cleanup-test';
    const timestamp = '2000';

    beforeEach(() => {
        uploads.length = 0;
        vi.spyOn(endpoint, 'htmlToPdf').mockResolvedValue(Buffer.from('PDF'));
        vi.spyOn(FileCache, 'write').mockResolvedValue();
    });

    afterEach(async () => {
        // Keep failed assertions from leaving test uploads on disk; cleanup is asserted first.
        await Promise.all(uploads.map(path => fs.rm(path, { force: true })));
        vi.restoreAllMocks();
    });

    /**
     * Builds a raw upload stream for the selected outcome. The HTML file precedes
     * the fields so even invalid authorization creates a file to clean up;
     * omitting the closing boundary exercises partial-upload cleanup.
     */
    function request(mode: string) {
        const boundary = 'StamhoofdRendererTest';
        const fields: Record<string, string> = {
            cacheId,
            timestamp,
            signature: signInternal(cacheId, timestamp, html),
        };
        if (mode === 'missing signature') delete fields.signature;
        if (mode === 'invalid signature') fields.signature = 'invalid';
        if (mode === 'expired authorization') fields.expires = String(Date.now() - 1000);
        let body = `--${boundary}\r\nContent-Disposition: form-data; name="html"; filename="document.html"\r\nContent-Type: text/html\r\n\r\n${html}\r\n`;
        for (const [name, value] of Object.entries(fields)) {
            body += `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`;
        }
        body += mode === 'malformed multipart' ? '' : `--${boundary}--\r\n`;
        const stream = Readable.from([Buffer.from(body)]) as unknown as IncomingMessage;
        stream.headers = {
            'content-type': `multipart/form-data; boundary=${boundary}`,
            'content-length': Buffer.byteLength(body).toString(),
        };
        const request = Request.post({ path: '/html-to-pdf' });
        request.request = stream;
        return request;
    }

    /**
     * Both successful responses and rejected requests must remove every observed
     * upload before handle settles. Requiring an observed path prevents an empty
     * upload list from satisfying the ENOENT checks without exercising cleanup.
     * An expired grant must also reject the request without retaining its upload.
     */
    test.each(['success', 'missing signature', 'invalid signature', 'malformed multipart', 'render failure', 'expired authorization'])('removes uploaded files after %s', async (mode) => {
        if (mode === 'render failure') vi.mocked(endpoint.htmlToPdf).mockResolvedValue(null);
        const decoded = await endpoint.decode(request(mode));
        expect(decoded).not.toBeNull();
        const result = endpoint.handle(decoded!);
        if (mode === 'success') {
            expect((await result).status).toBe(200);
        }
        else {
            await expect(result).rejects.toThrow();
        }
        expect(uploads.length).toBeGreaterThan(0);
        for (const path of uploads) {
            await expect(fs.stat(path)).rejects.toMatchObject({ code: 'ENOENT' });
        }
    });
});
