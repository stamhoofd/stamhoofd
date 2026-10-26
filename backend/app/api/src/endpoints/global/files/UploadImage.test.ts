import type { PutObjectCommand } from '@aws-sdk/client-s3';
import { Request } from '@simonbackx/simple-endpoints';
import { Image, OrganizationFactory, Token, UserFactory } from '@stamhoofd/models';
import { PermissionLevel } from '@stamhoofd/types/PermissionLevel';
import { Permissions } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import type { IncomingMessage } from 'node:http';
import { Readable } from 'node:stream';
// The root pins the same sharp used by models; intercept rendering without allocating large images.
// eslint-disable-next-line import/no-extraneous-dependencies
import sharp from 'sharp';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defaultOptions } from 'formidable';
import { SessionService } from '../../../services/SessionService.js';

import { testServer } from '../../../../tests/helpers/TestServer.js';
import { UploadImage } from './UploadImage.js';

/**
 * A real (1x1 pixel) png, so sharp can generate resolutions from it
 */
const pngContent = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

const svgContent = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script><rect width="10" height="10" fill="red"/></svg>');

describe('Endpoint.UploadImage', () => {
    const endpoint = new UploadImage();

    /**
     * All the objects that were sent to the (mocked) file server
     */
    let uploads: PutObjectCommand['input'][] = [];
    let uploadDirectory: string;
    const originalUploadDirectory = defaultOptions.uploadDir;

    /**
     * Keep real multipart parsing and filesystem writes inside a per-test root.
     * TMPDIR captures endpoint-owned subdirectories; Formidable's default upload
     * directory also points here. Only S3 is mocked, so directory assertions check
     * actual removal rather than just observing a cleanup call.
     */
    beforeEach(async () => {
        uploadDirectory = await fs.mkdtemp(join(tmpdir(), 'upload-image-test-'));
        vi.stubEnv('TMPDIR', uploadDirectory);
        defaultOptions.uploadDir = uploadDirectory;
        TestUtils.setEnvironment('SPACES_BUCKET', 'test-bucket');
        TestUtils.setEnvironment('SPACES_ENDPOINT', 'test.digitaloceanspaces.com');
        TestUtils.setEnvironment('SPACES_KEY', 'test-key');
        TestUtils.setEnvironment('SPACES_SECRET', 'test-secret');

        uploads = [];
        Image.s3Client = {
            send: (command: PutObjectCommand) => {
                uploads.push(command.input);
                return Promise.resolve({});
            },
        } as any;
    });

    // Restore process-wide parser/environment state and remove the test root itself.
    afterEach(async () => {
        Image.s3Client = null;
        vi.restoreAllMocks();
        vi.unstubAllEnvs();
        defaultOptions.uploadDir = originalUploadDirectory;
        await fs.rm(uploadDirectory, { recursive: true, force: true });
    });

    /**
     * Returns an authenticated organization-admin request backed by a real
     * multipart stream. Resolutions default to a 50 x 50 inside fit; metadata
     * overrides the JSON verbatim to exercise syntax and decoding failures.
     * field renames the required file part, and extraFile appends a second image
     * to exercise parser rejection after temporary files may have been written.
     */
    const buildUploadRequest = async (data: { filename: string; contentType: string; content: Buffer; resolutions?: object[]; metadata?: string; field?: string; extraFile?: boolean }) => {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({
            organization,
            permissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();
        const token = await SessionService.createSession(user);

        const boundary = '--------------------------StamhoofdTest';
        const body = Buffer.concat([
            Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="resolutions"\r\n\r\n${data.metadata ?? JSON.stringify(data.resolutions ?? [{ width: 50, height: 50, fit: 'inside' }])}\r\n`),
            Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${data.field ?? 'file'}"; filename="${data.filename}"\r\nContent-Type: ${data.contentType}\r\n\r\n`),
            data.content,
            ...(data.extraFile ? [Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="extra"; filename="extra.png"\r\nContent-Type: image/png\r\n\r\n`), pngContent] : []),
            Buffer.from(`\r\n--${boundary}--\r\n`),
        ]);

        const stream = Readable.from([body]) as unknown as IncomingMessage;
        stream.headers = {
            'content-type': `multipart/form-data; boundary=${boundary}`,
            'content-length': body.length.toString(),
        };

        const r = Request.buildJson('POST', '/v1/upload-image', organization.getApiHost());
        r.headers.authorization = 'Bearer ' + token.accessToken;
        r.request = stream;
        r.query = {};

        return r;
    };

    /**
     * Invalid JSON, undecodable resolutions, a wrong file field and an extra file
     * must all reject without storage. An empty real upload root also excludes
     * leaked partial files and empty endpoint-owned directories, regardless of
     * which parsing or validation stage rejected the request.
     */
    test.each([
        { metadata: '{' },
        { metadata: '[{"width":"invalid"}]' },
        { field: 'wrong' },
        { extraFile: true },
    ])('It removes temporary resources after rejecting %j', async (options) => {
        const r = await buildUploadRequest({ filename: 'logo.png', contentType: 'image/png', content: pngContent, ...options });
        await expect(testServer.test(endpoint, r)).rejects.toThrow();
        expect(await fs.readdir(uploadDirectory)).toEqual([]);
        expect(uploads).toHaveLength(0);
    });

    /**
     * Rejects excessive variant counts, invalid dimensions and per-variant or total
     * pixel budgets through the anonymous upload path. A fixed IP lets that path
     * reach validation. The rendering spy must remain untouched, and the storage
     * capture must stay empty: rejection alone would not prove work was bounded.
     */
    test.each([
        ['too many variants', Array.from({ length: 9 }, () => ({ width: 10 }))],
        ['an oversized dimension', [{ width: 8193 }]],
        ['missing dimensions', [{}]],
        ['too many output pixels', [{ width: 8192, height: 8192, fit: 'fill' }]],
        ['too much total work', Array.from({ length: 8 }, () => ({ width: 3000, height: 3000, fit: 'fill' }))],
    ])('It rejects %s before rendering or storage', async (_name, resolutions) => {
        const render = vi.spyOn(sharp.prototype, 'toBuffer').mockRejectedValue(new Error('Rendering was reached'));
        const r = await buildUploadRequest({ filename: 'logo.svg', contentType: 'image/svg+xml', content: svgContent, resolutions });
        delete r.headers.authorization;
        vi.spyOn(r, 'getIP').mockReturnValue('127.0.0.1');

        await expect(testServer.test(endpoint, r)).rejects.toMatchObject({ code: 'invalid_resolutions' });
        expect(render).not.toHaveBeenCalled();
        expect(uploads).toHaveLength(0);
    });

    /**
     * A tiny SVG document can describe a 100-million-pixel raster. Sharp must
     * reject those input dimensions while reading metadata, without materializing
     * a rendered buffer or uploading either a variant or the source.
     */
    test('It rejects excessive SVG input pixels before rendering or storage', async () => {
        const render = vi.spyOn(sharp.prototype, 'toBuffer').mockRejectedValue(new Error('Rendering was reached'));
        const r = await buildUploadRequest({
            filename: 'large.svg', contentType: 'image/svg+xml',
            content: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10000" height="10000"/>'),
        });
        await expect(testServer.test(endpoint, r)).rejects.toThrow(/pixel limit/i);
        expect(render).not.toHaveBeenCalled();
        expect(uploads).toHaveLength(0);
    });

    /**
     * A 1:100 SVG needs a 100,000-pixel height when resized to width 1000,
     * whether height is omitted or an outside fit supplies a square minimum.
     * Validate the derived dimensions, not just the requested axes, before any
     * buffer rendering or storage can occur.
     */
    test.each([
        [{ width: 1000 }],
        [{ width: 1000, height: 1000, fit: 'outside' }],
    ])('It bounds aspect-ratio-derived output dimensions (%j)', async (resolution) => {
        const render = vi.spyOn(sharp.prototype, 'toBuffer').mockRejectedValue(new Error('Rendering was reached'));
        const r = await buildUploadRequest({
            filename: 'tall.svg', contentType: 'image/svg+xml', resolutions: [resolution],
            content: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="100"/>'),
        });
        await expect(testServer.test(endpoint, r)).rejects.toMatchObject({ code: 'invalid_resolutions' });
        expect(render).not.toHaveBeenCalled();
        expect(uploads).toHaveLength(0);
    });

    /**
     * Positive controls for the UI's seven cover variants and invoice background.
     * The small PNG keeps real rendering inexpensive; one returned resolution per
     * request verifies that valid presets are accepted without dropping variants.
     */
    test.each([
        [[1920, 1280, 960, 700, 600, 300, 100].map(width => ({ width }))],
        [[{ width: 2480, height: 3508, fit: 'outside' }]],
    ])('It accepts existing cover and invoice requests (%j)', async (resolutions) => {
        const r = await buildUploadRequest({ filename: 'logo.png', contentType: 'image/png', content: pngContent, resolutions });
        const response = await testServer.test(endpoint, r);
        expect(response.body.resolutions).toHaveLength(resolutions.length);
    });

    test('It stores a png, and never stores the original with a content type of the uploader', async () => {
        const r = await buildUploadRequest({ filename: 'logo.png', contentType: 'image/png', content: pngContent });
        const response = await testServer.test(endpoint, r);

        expect(response.body.resolutions).toHaveLength(1);

        // The generated image is public and rendered inline in the browser
        expect(uploads[0]).toMatchObject({
            ContentType: 'image/png',
            ACL: 'public-read',
        });

        // Forcing a download here would break every image in our emails and pdfs
        expect(uploads[0].ContentDisposition).toBeUndefined();

        // The original is never rendered
        expect(uploads[1]).toMatchObject({
            ContentType: 'image/png',
            ContentDisposition: 'attachment',
            ACL: 'private',
        });
    });

    /**
     * An svg can contain scripts, so a browser may never render one: it is always stored privately and as an
     * attachment, whatever else the upload results in.
     */
    const expectNoRenderableSvg = () => {
        const svgUploads = uploads.filter(upload => upload.ContentType === 'image/svg+xml' || upload.Key?.endsWith('.svg'));

        for (const upload of svgUploads) {
            expect(upload.ContentDisposition).toBe('attachment');
            expect(upload.ACL).toBe('private');
        }

        return svgUploads;
    };

    test('It rasterizes an svg, so the uploaded svg itself is never served', async () => {
        const r = await buildUploadRequest({ filename: 'logo.svg', contentType: 'image/svg+xml', content: svgContent });
        const response = await testServer.test(endpoint, r);

        expect(response.body.resolutions).toHaveLength(1);
        expect(uploads[0]).toMatchObject({
            ContentType: 'image/png',
            ACL: 'public-read',
        });

        expect(uploads[1]).toMatchObject({
            ContentType: 'image/svg+xml',
            ContentDisposition: 'attachment',
            ACL: 'private',
        });

        // Every public file we generated from the svg is a rasterized image
        expect(expectNoRenderableSvg()).toHaveLength(1);
    });

    test('It never publishes the svg itself, even when no resolutions are requested', async () => {
        // Without resolutions there is nothing to rasterize, so the uploaded svg is the only stored file - and
        // Image.getPublicPath() falls back to it
        const r = await buildUploadRequest({ filename: 'logo.svg', contentType: 'image/svg+xml', content: svgContent, resolutions: [] });
        const response = await testServer.test(endpoint, r);

        expect(response.body.resolutions).toHaveLength(0);
        expect(uploads).toHaveLength(1);
        expect(expectNoRenderableSvg()).toHaveLength(1);
    });

    test('It refuses a file that is not an image, even without resolutions', async () => {
        const r = await buildUploadRequest({
            filename: 'evil.html',
            contentType: 'text/html',
            content: Buffer.from('<script>alert(1)</script>'),
            resolutions: [],
        });

        await expect(testServer.test(endpoint, r)).rejects.toThrow(/unsupported image type/i);
        expect(uploads).toHaveLength(0);
    });

    test('It refuses an image with a content type we cannot generate resolutions from', async () => {
        const r = await buildUploadRequest({ filename: 'photo.tiff', contentType: 'image/tiff', content: pngContent });

        await expect(testServer.test(endpoint, r)).rejects.toThrow(/unsupported image type/i);
        expect(uploads).toHaveLength(0);
    });

    test('It uses the extension when the uploader does not report a usable content type', async () => {
        const r = await buildUploadRequest({ filename: 'logo.png', contentType: 'application/octet-stream', content: pngContent });
        const response = await testServer.test(endpoint, r);

        expect(response.body.resolutions).toHaveLength(1);
        expect(uploads[1]).toMatchObject({
            ContentType: 'image/png',
            ContentDisposition: 'attachment',
        });
    });
});
