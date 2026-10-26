import type { PutObjectCommand } from '@aws-sdk/client-s3';
import { Request } from '@simonbackx/simple-endpoints';
import { Image, OrganizationFactory, Token, UserFactory } from '@stamhoofd/models';
import { PermissionLevel } from '@stamhoofd/types/PermissionLevel';
import { Permissions } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { promises as fs } from 'fs';
import type { IncomingMessage } from 'node:http';
import { Readable } from 'node:stream';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defaultOptions } from 'formidable';
import { SessionService } from '../../../services/SessionService.js';

import { testServer } from '../../../../tests/helpers/TestServer.js';
import { UploadFile } from './UploadFile.js';

describe('Endpoint.UploadFile', () => {
    const endpoint = new UploadFile();

    /**
     * All the objects that were sent to the (mocked) file server
     */
    let uploads: PutObjectCommand['input'][] = [];

    /**
     * All the paths the endpoint tried to clean up
     */
    let temporaryFiles: string[] = [];
    let uploadDirectory: string;
    const originalUploadDirectory = defaultOptions.uploadDir;

    /**
     * Isolate real multipart writes in a per-test root, covering both TMPDIR-based
     * endpoint directories and Formidable's default upload location. S3 is mocked;
     * the rm spy records cleanup paths while still performing real deletions.
     */
    beforeEach(async () => {
        uploadDirectory = await fs.mkdtemp(join(tmpdir(), 'upload-file-test-'));
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

        temporaryFiles = [];
        const rm = fs.rm;
        vi.spyOn(fs, 'rm').mockImplementation(async (path, options) => {
            temporaryFiles.push(path as string);
            return await rm(path, options);
        });
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
     * Returns an authenticated organization-admin request with a real multipart
     * file stream and an optional private query. field renames the required part;
     * extraFile adds a second PDF to trigger the file-count limit. These malformed
     * bodies still pass through Formidable and can create temporary files.
     */
    const buildUploadRequest = async (data: { filename: string; contentType: string; content?: string; isPrivate?: boolean; field?: string; extraFile?: boolean }) => {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({
            organization,
            permissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();
        const token = await SessionService.createSession(user);

        const boundary = '--------------------------StamhoofdTest';
        const body = Buffer.concat([
            Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${data.field ?? 'file'}"; filename="${data.filename}"\r\nContent-Type: ${data.contentType}\r\n\r\n`),
            Buffer.from(data.content ?? 'Hello world'),
            ...(data.extraFile ? [Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="extra"; filename="extra.pdf"\r\nContent-Type: application/pdf\r\n\r\nextra`)] : []),
            Buffer.from(`\r\n--${boundary}--\r\n`),
        ]);

        const stream = Readable.from([body]) as unknown as IncomingMessage;
        stream.headers = {
            'content-type': `multipart/form-data; boundary=${boundary}`,
            'content-length': body.length.toString(),
        };

        const r = Request.buildJson('POST', '/v1/upload-file', organization.getApiHost());
        r.headers.authorization = 'Bearer ' + token.accessToken;
        r.request = stream;
        r.query = data.isPrivate ? { private: true } : {};

        return r;
    };

    /**
     * Reject a missing required file field or excess file count without uploading.
     * Checking the real test root after rejection verifies removal of partial
     * uploads and endpoint-owned subdirectories, not merely a call to fs.rm.
     */
    test.each([{ field: 'wrong' }, { extraFile: true }])('It removes temporary resources after rejecting %j', async (options) => {
        const r = await buildUploadRequest({ filename: 'document.pdf', contentType: 'application/pdf', ...options });
        await expect(testServer.test(endpoint, r)).rejects.toThrow();
        expect(await fs.readdir(uploadDirectory)).toEqual([]);
        expect(uploads).toHaveLength(0);
    });

    test('It stores a pdf with the reported content type, and lets the browser render it', async () => {
        const r = await buildUploadRequest({ filename: 'Mijn document.pdf', contentType: 'application/pdf' });
        const response = await testServer.test(endpoint, r);

        expect(response.body.contentType).toBe('application/pdf');
        expect(response.body.name).toBe('Mijn document.pdf');
        expect(response.body.path).toMatch(/\/mijn-document\.pdf$/);

        expect(uploads).toHaveLength(1);
        expect(uploads[0]).toMatchObject({
            Key: response.body.path,
            ContentType: 'application/pdf',
            ContentDisposition: 'inline',
            ACL: 'public-read',
        });
    });

    test('It uses the extension when the uploader does not report a usable content type', async () => {
        const r = await buildUploadRequest({ filename: 'ledenlijst.xlsx', contentType: 'application/octet-stream' });
        const response = await testServer.test(endpoint, r);

        expect(response.body.contentType).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        expect(uploads[0]).toMatchObject({
            ContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            // A browser can execute an office document, so it is never rendered
            ContentDisposition: 'attachment',
        });
    });

    test('It ignores a content type we do not support, and uses the extension', async () => {
        const r = await buildUploadRequest({ filename: 'document.pdf', contentType: 'text/html', content: '<script>alert(1)</script>' });
        const response = await testServer.test(endpoint, r);

        // Whatever is inside the file, a browser only ever gets it as a pdf
        expect(response.body.contentType).toBe('application/pdf');
        expect(uploads[0]).toMatchObject({
            ContentType: 'application/pdf',
        });
    });

    test('It renames a file that was uploaded with the extension of another content type', async () => {
        const r = await buildUploadRequest({ filename: 'foto.png', contentType: 'image/jpeg' });
        const response = await testServer.test(endpoint, r);

        expect(response.body.contentType).toBe('image/jpeg');
        expect(response.body.name).toBe('foto.jpg');
        expect(response.body.path).toMatch(/\/foto\.jpg$/);
        expect(uploads[0]).toMatchObject({
            ContentType: 'image/jpeg',
        });
    });

    test('It stores the file with the extension of the resolved content type', async () => {
        const r = await buildUploadRequest({ filename: 'Foto.JPEG', contentType: 'image/jpg' });
        const response = await testServer.test(endpoint, r);

        expect(response.body.contentType).toBe('image/jpeg');
        expect(response.body.name).toBe('Foto.jpeg');
        expect(response.body.path).toMatch(/\/foto\.jpeg$/);
        expect(uploads[0]).toMatchObject({
            ContentType: 'image/jpeg',
            ContentDisposition: 'inline',
        });
    });

    test('It stores a file without a usable name', async () => {
        const r = await buildUploadRequest({ filename: '.pdf', contentType: 'application/pdf' });
        const response = await testServer.test(endpoint, r);

        expect(response.body.name).toBeNull();

        // Falls back to the id of the file, instead of storing it without a name
        expect(response.body.path).toMatch(new RegExp('/' + response.body.id + '/' + response.body.id + '\\.pdf$'));
    });

    test('It refuses a file with a content type browsers could execute', async () => {
        const r = await buildUploadRequest({ filename: 'evil.html', contentType: 'text/html', content: '<script>alert(1)</script>' });

        await expect(testServer.test(endpoint, r)).rejects.toThrow(/unsupported file type/i);
        expect(uploads).toHaveLength(0);
    });

    test('It refuses an svg image', async () => {
        const r = await buildUploadRequest({ filename: 'evil.svg', contentType: 'image/svg+xml', content: '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>' });

        await expect(testServer.test(endpoint, r)).rejects.toThrow(/unsupported file type/i);
        expect(uploads).toHaveLength(0);
    });

    test('It refuses a file we cannot determine a safe content type for', async () => {
        const r = await buildUploadRequest({ filename: 'backup', contentType: 'application/octet-stream' });

        await expect(testServer.test(endpoint, r)).rejects.toThrow(/unsupported file type/i);
        expect(uploads).toHaveLength(0);
    });

    test('It stores private files as an attachment too', async () => {
        const r = await buildUploadRequest({ filename: 'contract.pdf', contentType: 'application/pdf', isPrivate: true });
        const response = await testServer.test(endpoint, r);

        expect(response.body.isPrivate).toBe(true);
        expect(response.body.signature).not.toBeNull();
        expect(uploads[0]).toMatchObject({
            ContentType: 'application/pdf',
            ACL: 'private',
        });
    });

    test('It cleans up the temporary file of the upload', async () => {
        const rejected = await buildUploadRequest({ filename: 'evil.html', contentType: 'text/html' });
        await expect(testServer.test(endpoint, rejected)).rejects.toThrow(/unsupported file type/i);

        const accepted = await buildUploadRequest({ filename: 'document.pdf', contentType: 'application/pdf' });
        await testServer.test(endpoint, accepted);

        expect(temporaryFiles).toHaveLength(2);

        for (const path of temporaryFiles) {
            await expect(fs.stat(path)).rejects.toThrow(/ENOENT/);
        }
    });
});
