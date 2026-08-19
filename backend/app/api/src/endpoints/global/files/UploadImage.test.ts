import type { PutObjectCommand } from '@aws-sdk/client-s3';
import { Request } from '@simonbackx/simple-endpoints';
import { Image, OrganizationFactory, Token, UserFactory } from '@stamhoofd/models';
import { PermissionLevel, Permissions } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import type { IncomingMessage } from 'node:http';
import { Readable } from 'node:stream';
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

    beforeEach(() => {
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

    afterEach(() => {
        Image.s3Client = null;
    });

    /**
     * Builds a multipart/form-data request with a single uploaded image, like a browser would send it
     */
    const buildUploadRequest = async (data: { filename: string; contentType: string; content: Buffer; resolutions?: object[] }) => {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({
            organization,
            permissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();
        const token = await SessionService.createSession(user);

        const boundary = '--------------------------StamhoofdTest';
        const body = Buffer.concat([
            Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="resolutions"\r\n\r\n${JSON.stringify(data.resolutions ?? [{ width: 50, height: 50, fit: 'inside' }])}\r\n`),
            Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${data.filename}"\r\nContent-Type: ${data.contentType}\r\n\r\n`),
            data.content,
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
