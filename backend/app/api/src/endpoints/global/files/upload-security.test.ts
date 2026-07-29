import type { PutObjectCommand } from '@aws-sdk/client-s3';
import { S3Client } from '@aws-sdk/client-s3';
import { Request } from '@simonbackx/simple-endpoints';
import type { Organization } from '@stamhoofd/models';
import { Image, OrganizationFactory, Token, UserFactory } from '@stamhoofd/models';
import { File, PermissionLevel, Permissions } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import type { IncomingMessage } from 'node:http';
import { Readable } from 'node:stream';

import { testServer } from '../../../../tests/helpers/TestServer.js';
import { FileSignService } from '../../../services/FileSignService.js';
import { UploadFile } from './UploadFile.js';
import { limiter, UploadImage } from './UploadImage.js';

/**
 * Adversarial tests for the upload endpoints.
 *
 * Everything we store is served back from a domain of ours, so an upload may never end up on the file server
 * with a content type a browser executes, with a key we didn't build ourselves, or with a public ACL the
 * uploader wasn't allowed to ask for.
 */

/**
 * A real (1x1 pixel) png, so sharp can generate resolutions from it
 */
const pngContent = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

const svgContent = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script><rect width="10" height="10" fill="red"/></svg>');

const htmlContent = Buffer.from('<!DOCTYPE html><html><body><script>alert(document.domain)</script></body></html>');

const xxeContent = Buffer.from('<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><foo>&xxe;</foo>');

/**
 * The only content types a browser may render inline: a pdf is opened in the pdf viewer, which has no access
 * to the page it is served from, and a browser only ever sniffs an image as another image type.
 */
const inlineSafeContentTypes = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/heic',
    'image/heif',
];

/**
 * Content types a browser executes on the domain it downloads them from
 */
const executableContentTypes = [
    'text/html',
    'image/svg+xml',
    'image/svg',
    'text/xml',
    'application/xml',
    'application/xhtml+xml',
    'text/javascript',
    'application/javascript',
    'application/wasm',
    'application/x-httpd-php',
];

const boundary = '--------------------------StamhoofdSecurityTest';

type RawPart = {
    /**
     * The raw headers of this part, without the trailing empty line
     */
    headers: string;
    body: Buffer | string;
};

/**
 * Builds the part a browser sends for <input type="file">. Pass null to leave a header out completely.
 */
const filePart = (data: { filename?: string | null; contentType?: string | null; content?: Buffer | string; name?: string }): RawPart => {
    let headers = `Content-Disposition: form-data; name="${data.name ?? 'file'}"`;

    if (data.filename !== null && data.filename !== undefined) {
        headers += `; filename="${data.filename}"`;
    }

    if (data.contentType !== null && data.contentType !== undefined) {
        headers += `\r\nContent-Type: ${data.contentType}`;
    }

    return { headers, body: data.content ?? 'Hello world' };
};

const fieldPart = (name: string, value: string): RawPart => {
    return { headers: `Content-Disposition: form-data; name="${name}"`, body: value };
};

describe('Upload security', () => {
    const uploadFileEndpoint = new UploadFile();
    const uploadImageEndpoint = new UploadImage();

    /**
     * All the objects that were sent to the (mocked) file server
     */
    let uploads: PutObjectCommand['input'][] = [];

    let organization: Organization;
    let adminToken: string;
    let memberToken: string;
    let adminUserId: string;
    let memberUserId: string;

    beforeAll(async () => {
        organization = await new OrganizationFactory({}).create();

        const admin = await new UserFactory({
            organization,
            permissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();
        adminUserId = admin.id;
        adminToken = (await Token.createToken(admin)).accessToken;

        // A user without any permissions: it may only upload private files
        const member = await new UserFactory({ organization }).create();
        memberUserId = member.id;
        memberToken = (await Token.createToken(member)).accessToken;
    });

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

        // These tests share one user, so the (per user) upload rate limit may not carry over between them
        for (const window of limiter.windows) {
            window.windows.clear();
        }
    });

    afterEach(() => {
        Image.s3Client = null;
    });

    const buildRequest = (url: string, parts: RawPart[], options: { isPrivate?: boolean; contentLength?: string; token?: string } = {}) => {
        const chunks: Buffer[] = [];

        for (const part of parts) {
            chunks.push(Buffer.from(`--${boundary}\r\n${part.headers}\r\n\r\n`));
            chunks.push(Buffer.isBuffer(part.body) ? part.body : Buffer.from(part.body));
            chunks.push(Buffer.from('\r\n'));
        }
        chunks.push(Buffer.from(`--${boundary}--\r\n`));

        const body = Buffer.concat(chunks);
        const stream = Readable.from([body]) as unknown as IncomingMessage;
        stream.headers = {
            'content-type': `multipart/form-data; boundary=${boundary}`,
            'content-length': options.contentLength ?? body.length.toString(),
        };

        const r = Request.buildJson('POST', url, organization.getApiHost());
        r.headers.authorization = 'Bearer ' + (options.token ?? adminToken);
        r.request = stream;
        r.query = options.isPrivate ? { private: true } : {};

        return r;
    };

    const uploadFile = async (data: { filename?: string | null; contentType?: string | null; content?: Buffer | string }, options: { isPrivate?: boolean; token?: string } = {}) => {
        return await testServer.test(uploadFileEndpoint, buildRequest('/v1/upload-file', [filePart(data)], options));
    };

    const uploadImage = async (data: { filename?: string | null; contentType?: string | null; content?: Buffer | string; resolutions?: object[] }, options: { isPrivate?: boolean; token?: string } = {}) => {
        return await testServer.test(uploadImageEndpoint, buildRequest('/v1/upload-image', [
            fieldPart('resolutions', JSON.stringify(data.resolutions ?? [{ width: 50, height: 50, fit: 'inside' }])),
            filePart(data),
        ], options));
    };

    /**
     * The invariants that have to hold for every object we sent to the file server, whatever was uploaded.
     */
    const expectSafeUploads = () => {
        for (const upload of uploads) {
            const key = upload.Key;
            expect(key).toBeDefined();

            // Only the characters we generate ourselves: a slug, uuids and slashes
            expect(key, 'Unsafe key').toMatch(/^[a-z0-9\-/]+\.[a-z0-9]+$/);
            expect(key!.split('/'), 'Key escapes its prefix').not.toContain('..');
            expect(key, 'Key contains a relative path').not.toContain('..');

            // Exactly one extension, and only in the last segment of the key
            const segments = key!.split('/');
            expect(segments.filter(segment => segment.includes('.')), 'More than one extension in ' + key).toHaveLength(1);
            expect(segments[segments.length - 1].split('.'), 'Double extension in ' + key).toHaveLength(2);

            // A browser only ever renders a file type it cannot execute
            if (upload.ContentDisposition === 'inline') {
                expect(inlineSafeContentTypes, 'Rendered inline: ' + upload.ContentType).toContain(upload.ContentType);
            }

            expect(['private', 'public-read'], 'Unexpected ACL').toContain(upload.ACL);

            // The only object we store with an executable content type is the private source of an image
            // upload, which is never served: it is private and stored as an attachment.
            if (executableContentTypes.includes(upload.ContentType!)) {
                expect(upload.ACL, 'Executable content type: ' + upload.ContentType).toBe('private');
                expect(upload.ContentDisposition, 'Executable content type: ' + upload.ContentType).toBe('attachment');
            }
        }
    };

    /**
     * A malformed or abusive request may be refused, but it may never result in an upload we didn't validate
     */
    const expectRejectedOrSafe = async (promise: Promise<unknown>) => {
        await promise.catch(() => { /* refusing the request is a valid outcome */ });
        expectSafeUploads();
    };

    describe('Key injection through the filename', () => {
        const attackFilenames = [
            '../../etc/passwd.pdf',
            '..\\..\\evil.pdf',
            '/etc/passwd.pdf',
            'folder/subfolder/evil.pdf',
            'evil.pdf/../../../root.pdf',
            '....pdf',
            '---.pdf',
            '你好.pdf',
            'ᴬᴮᶜ.pdf',
            '.....',
            'evil\u0000.pdf',
            'evil .pdf',
            'evil;rm -rf /.pdf',
            'evil\'`$().pdf',
            '‮fdp.evil.pdf',
            'a'.repeat(300) + '.pdf',
            '%2e%2e%2f%2e%2e%2fevil.pdf',
            'CON.pdf',
            '   .pdf',
        ];

        test('A filename can never change the key we upload to', async () => {
            for (const filename of attackFilenames) {
                uploads = [];

                const response = await uploadFile({ filename, contentType: 'application/pdf' });

                expectSafeUploads();
                expect(uploads, filename).toHaveLength(1);

                const key = uploads[0].Key!;

                // Inside the prefix of public uploads, and named after the id of the file
                expect(key, filename).toMatch(new RegExp('^test/p/' + response.body.id + '/[a-z0-9-]+\\.pdf$'));
                expect(key, filename).toBe(response.body.path);
                expect(uploads[0].ContentType, filename).toBe('application/pdf');
            }
        });

        test('A private upload always stays inside the prefix of its own user', async () => {
            for (const filename of ['../../p/public.pdf', '../' + memberUserId + '/stolen.pdf', 'evil.pdf']) {
                uploads = [];

                await uploadFile({ filename, contentType: 'application/pdf' }, { isPrivate: true });

                expectSafeUploads();
                expect(uploads[0].Key, filename).toMatch(new RegExp('^test/users/' + adminUserId + '/'));
                expect(uploads[0].ACL, filename).toBe('private');
            }
        });

        test('Two uploads with the same name never write to the same key', async () => {
            const first = await uploadFile({ filename: 'invoice.pdf', contentType: 'application/pdf' });
            const second = await uploadFile({ filename: 'invoice.pdf', contentType: 'application/pdf' });

            expect(first.body.path).not.toBe(second.body.path);
            expect(uploads[0].Key).not.toBe(uploads[1].Key);
            expectSafeUploads();
        });

        test('The name we report back always ends with the extension we stored the file with', async () => {
            for (const [filename, contentType, expected] of [
                ['evil.pdf.html', 'application/pdf', '.pdf'],
                ['evil.html', 'application/pdf', '.pdf'],
                ['evil.svg', 'image/png', '.png'],
                ['photo.png', 'image/jpeg', '.jpg'],
                ['notes.php', 'text/plain', '.txt'],
            ] as const) {
                const response = await uploadFile({ filename, contentType });

                expect(response.body.name, filename).toMatch(new RegExp(expected.replace('.', '\\.') + '$'));
                expect(File.resolveUploadType({ filename: response.body.name }), filename).not.toBeNull();
            }
        });
    });

    describe('Content type spoofing', () => {
        test('An executable payload is never stored with a content type a browser runs', async () => {
            const attacks: { filename: string; contentType: string; content: Buffer }[] = [
                { filename: 'evil.html', contentType: 'text/html', content: htmlContent },
                { filename: 'evil.svg', contentType: 'image/svg+xml', content: svgContent },
                { filename: 'evil.svg', contentType: 'image/svg', content: svgContent },
                { filename: 'evil.xml', contentType: 'text/xml', content: xxeContent },
                { filename: 'evil.xml', contentType: 'application/xml', content: xxeContent },
                { filename: 'evil.xhtml', contentType: 'application/xhtml+xml', content: htmlContent },
                { filename: 'evil.js', contentType: 'text/javascript', content: Buffer.from('alert(1)') },
                { filename: 'evil.wasm', contentType: 'application/wasm', content: Buffer.from('\0asm') },
                { filename: 'evil.php', contentType: 'application/x-httpd-php', content: Buffer.from('<?php system($_GET[0]); ?>') },
                { filename: 'evil.jsp', contentType: 'application/octet-stream', content: Buffer.from('<% out.print(1); %>') },
                { filename: 'evil.html', contentType: 'application/octet-stream', content: htmlContent },
                { filename: 'evil.html', contentType: '*/*', content: htmlContent },
                { filename: 'evil.html', contentType: '', content: htmlContent },
                { filename: 'evil.html', contentType: 'text/html; charset=utf-8', content: htmlContent },
                { filename: 'evil.html', contentType: 'TEXT/HTML', content: htmlContent },
            ];

            for (const attack of attacks) {
                uploads = [];
                const description = attack.filename + ' as ' + attack.contentType;

                await expectRejectedOrSafe(uploadFile(attack));

                // Neither the content type nor the extension is on the allowlist, so nothing is stored at all
                expect(uploads, description).toHaveLength(0);
            }
        });

        test('A server config or a script is stored as the plain text file it claims to be', async () => {
            // These are accepted (text/plain is on the allowlist), so the extension has to be neutralized
            for (const filename of ['.htaccess', 'evil.php', 'web.config', 'evil.jsp', 'evil.js']) {
                uploads = [];

                const response = await uploadFile({
                    filename,
                    contentType: 'text/plain',
                    content: Buffer.from('AddType application/x-httpd-php .pdf'),
                });

                expect(uploads, filename).toHaveLength(1);
                expect(uploads[0].ContentType, filename).toBe('text/plain');
                expect(uploads[0].ContentDisposition, filename).toBe('attachment');
                expect(uploads[0].Key, filename).toMatch(/\.txt$/);
                expect(response.body.path, filename).not.toMatch(/htaccess|php|config|jsp|\.js/);
                expectSafeUploads();
            }
        });

        test('A polyglot is served as the safe type it claims to be, never as what is inside it', async () => {
            // The bytes are html, but the browser is told it is a pdf and opens it in the pdf viewer
            const pdf = await uploadFile({ filename: 'polyglot.pdf', contentType: 'application/pdf', content: htmlContent });
            expect(uploads[0]).toMatchObject({
                ContentType: 'application/pdf',
                ContentDisposition: 'inline',
            });
            expect(pdf.body.contentType).toBe('application/pdf');

            uploads = [];

            // A browser never sniffs an image/png response into html
            await uploadFile({ filename: 'polyglot.png', contentType: 'image/png', content: htmlContent });
            expect(uploads[0]).toMatchObject({ ContentType: 'image/png' });

            uploads = [];

            // An svg that claims to be a png is stored, and served, as a png
            await uploadFile({ filename: 'evil.svg', contentType: 'image/png', content: svgContent });
            expect(uploads[0]).toMatchObject({ ContentType: 'image/png' });
            expect(uploads[0].Key).toMatch(/\.png$/);

            expectSafeUploads();
        });

        test('A content type header can never inject anything into what we store', async () => {
            const attacks = [
                'application/pdf\r\nX-Injected: 1',
                'application/pdf"; ContentDisposition="inline',
                'application/pdf; charset=utf-8',
                'application/pdf, text/html',
                '  application/pdf  ',
            ];

            for (const contentType of attacks) {
                uploads = [];

                // The filename makes sure the upload is accepted, so we can look at what was stored
                await expectRejectedOrSafe(uploadFile({ filename: 'notes.txt', contentType }));

                for (const upload of uploads) {
                    // Only our own literals are ever stored: never a value taken from the request
                    expect([...inlineSafeContentTypes, 'text/plain'], contentType).toContain(upload.ContentType);
                    expect(upload.ContentType, contentType).not.toContain('\r');
                    expect(upload.ContentType, contentType).not.toContain(';');
                }
            }
        });

        test('An upload without a filename or a content type is refused instead of guessed', async () => {
            await expectRejectedOrSafe(uploadFile({ filename: 'backup', contentType: 'application/octet-stream' }));
            expect(uploads).toHaveLength(0);

            await expectRejectedOrSafe(uploadFile({ filename: '', contentType: 'application/octet-stream' }));
            expect(uploads).toHaveLength(0);

            await expectRejectedOrSafe(uploadFile({ filename: 'backup' }));
            expect(uploads).toHaveLength(0);
        });
    });

    describe('Multipart abuse', () => {
        test('It refuses a request with more than one file', async () => {
            const request = buildRequest('/v1/upload-file', [
                filePart({ filename: 'invoice.pdf', contentType: 'application/pdf' }),
                filePart({ filename: 'evil.html', contentType: 'text/html', content: htmlContent }),
            ]);

            await expectRejectedOrSafe(testServer.test(uploadFileEndpoint, request));
            expect(uploads).toHaveLength(0);
        });

        test('A part without a filename can never smuggle in a content type or a key', async () => {
            // A part with a content type header is a file for formidable, even when it has no filename at all
            const executable = buildRequest('/v1/upload-file', [
                filePart({ filename: null, contentType: 'text/html', content: htmlContent }),
            ]);

            await expectRejectedOrSafe(testServer.test(uploadFileEndpoint, executable));
            expect(uploads).toHaveLength(0);

            // Without a content type header it is a field, so there is no file to upload
            const field = buildRequest('/v1/upload-file', [
                filePart({ filename: null, contentType: null, content: htmlContent }),
            ]);

            await expectRejectedOrSafe(testServer.test(uploadFileEndpoint, field));
            expect(uploads).toHaveLength(0);

            // An allowed content type without a filename is stored under a key we generated ourselves
            const response = await testServer.test(uploadFileEndpoint, buildRequest('/v1/upload-file', [
                filePart({ filename: null, contentType: 'application/pdf' }),
            ]));

            expectSafeUploads();
            expect(response.body.name).toBeNull();
            expect(uploads[0].Key).toBe('test/p/' + response.body.id + '/' + response.body.id + '.pdf');
            expect(uploads[0].ContentType).toBe('application/pdf');
        });

        test('A part with an empty filename never ends up with an empty key', async () => {
            for (const contentType of ['application/pdf', 'text/plain']) {
                uploads = [];

                const response = await testServer.test(uploadFileEndpoint, buildRequest('/v1/upload-file', [
                    filePart({ filename: '', contentType }),
                ]));

                expectSafeUploads();
                expect(uploads[0].Key, contentType).toBe('test/p/' + response.body.id + '/' + response.body.id + '.' + (contentType === 'text/plain' ? 'txt' : 'pdf'));
            }
        });

        test('It stores a part without a content type header safely, or not at all', async () => {
            const request = buildRequest('/v1/upload-file', [
                filePart({ filename: 'evil.html', contentType: null, content: htmlContent }),
            ]);

            await expectRejectedOrSafe(testServer.test(uploadFileEndpoint, request));
            expect(uploads).toHaveLength(0);

            const allowed = buildRequest('/v1/upload-file', [
                filePart({ filename: 'invoice.pdf', contentType: null }),
            ]);

            await expectRejectedOrSafe(testServer.test(uploadFileEndpoint, allowed));
            expectSafeUploads();
        });

        test('A quote or a second filename in the part headers never changes what we store', async () => {
            const attacks = [
                'evil".pdf',
                'invoice.pdf"; filename="evil.html',
                'invoice.pdf; filename=evil.html',
                'evil.html"; filename="invoice.pdf',
            ];

            for (const filename of attacks) {
                uploads = [];

                await expectRejectedOrSafe(testServer.test(uploadFileEndpoint, buildRequest('/v1/upload-file', [
                    filePart({ filename, contentType: 'text/html', content: htmlContent }),
                ])));

                // The header parser may end up with any of the two filenames, but never with something that
                // makes us store an executable file
                for (const upload of uploads) {
                    expect(upload.ContentType, filename).not.toBe('text/html');
                    expect(upload.Key, filename).not.toMatch(/\.x?html?$/);
                }
            }
        });

        test('A filename with a line break never breaks the part headers open', async () => {
            const request = buildRequest('/v1/upload-file', [
                { headers: 'Content-Disposition: form-data; name="file"; filename="evil\r\nContent-Type: text/html\r\n.pdf"', body: htmlContent },
            ]);

            await expectRejectedOrSafe(testServer.test(uploadFileEndpoint, request));

            for (const upload of uploads) {
                expect(upload.ContentType).not.toBe('text/html');
            }
        });

        test('A declared content length that does not match the body never bypasses validation', async () => {
            const oversized = buildRequest('/v1/upload-file', [
                filePart({ filename: 'evil.html', contentType: 'text/html', content: htmlContent }),
            ], { contentLength: (100 * 1024 * 1024).toString() });

            await expectRejectedOrSafe(testServer.test(uploadFileEndpoint, oversized));
            expect(uploads).toHaveLength(0);

            const undersized = buildRequest('/v1/upload-file', [
                filePart({ filename: 'evil.svg', contentType: 'image/svg+xml', content: svgContent }),
            ], { contentLength: '1' });

            await expectRejectedOrSafe(testServer.test(uploadFileEndpoint, undersized));
            expect(uploads).toHaveLength(0);
        });

        test('Extra fields never make us skip the validation of the file', async () => {
            const withFields = buildRequest('/v1/upload-file', [
                fieldPart('contentType', 'application/pdf'),
                fieldPart('extension', 'pdf'),
                filePart({ filename: 'evil.html', contentType: 'text/html', content: htmlContent }),
            ]);

            await expectRejectedOrSafe(testServer.test(uploadFileEndpoint, withFields));
            expect(uploads).toHaveLength(0);
        });

        test('It refuses an image upload with a duplicated resolutions field', async () => {
            const request = buildRequest('/v1/upload-image', [
                fieldPart('resolutions', JSON.stringify([{ width: 50, height: 50, fit: 'inside' }])),
                fieldPart('resolutions', JSON.stringify([{ width: 50, height: 50, fit: 'inside' }])),
                filePart({ filename: 'evil.svg', contentType: 'image/svg+xml', content: svgContent }),
            ]);

            await expectRejectedOrSafe(testServer.test(uploadImageEndpoint, request));
            expect(uploads).toHaveLength(0);
        });

        test('It refuses an image upload with more than one file', async () => {
            const request = buildRequest('/v1/upload-image', [
                fieldPart('resolutions', JSON.stringify([{ width: 50, height: 50, fit: 'inside' }])),
                filePart({ filename: 'logo.png', contentType: 'image/png', content: pngContent }),
                filePart({ filename: 'evil.svg', contentType: 'image/svg+xml', content: svgContent }),
            ]);

            await expectRejectedOrSafe(testServer.test(uploadImageEndpoint, request));
            expect(uploads).toHaveLength(0);
        });
    });

    describe('Private and public uploads', () => {
        test('A user without permissions can only upload private files', async () => {
            await expect(uploadFile({ filename: 'invoice.pdf', contentType: 'application/pdf' }, { token: memberToken })).rejects.toThrow();
            expect(uploads).toHaveLength(0);

            const response = await uploadFile({ filename: 'invoice.pdf', contentType: 'application/pdf' }, { token: memberToken, isPrivate: true });

            expect(response.body.isPrivate).toBe(true);
            expect(uploads[0].ACL).toBe('private');
            expect(uploads[0].Key).toMatch(new RegExp('^test/users/' + memberUserId + '/'));
        });

        test('A private upload is never readable without a signature', async () => {
            const response = await uploadFile({ filename: 'contract.pdf', contentType: 'application/pdf' }, { isPrivate: true });

            expect(uploads[0].ACL).toBe('private');
            expect(uploads[0].ACL).not.toBe('public-read');
            expect(response.body.signature).toBeTruthy();
            expect(await response.body.verify()).toBe(true);

            // Changing anything about the file breaks the signature, so the path can't be swapped afterwards
            response.body.path = 'test/users/' + memberUserId + '/stolen.pdf';
            expect(await response.body.verify()).toBe(false);
        });

        test('A public upload is never signed, and its content type does not change its ACL', async () => {
            for (const contentType of ['application/pdf', 'text/plain', 'image/png']) {
                uploads = [];

                const response = await uploadFile({ filename: 'file.' + (contentType === 'text/plain' ? 'txt' : contentType.split('/')[1]), contentType });

                expect(response.body.isPrivate, contentType).toBe(false);
                expect(response.body.signature, contentType).toBeNull();
                expect(uploads[0].ACL, contentType).toBe('public-read');
            }
        });

        test('A file we refuse is refused in private mode too', async () => {
            for (const isPrivate of [false, true]) {
                uploads = [];

                await expect(uploadFile({ filename: 'evil.html', contentType: 'text/html', content: htmlContent }, { isPrivate })).rejects.toThrow(/unsupported file type/i);
                expect(uploads).toHaveLength(0);
            }
        });
    });

    describe('Image uploads', () => {
        /**
         * Every object a browser can reach has to be a raster image generated by sharp
         */
        const expectNoPublicSvg = () => {
            for (const upload of uploads) {
                if (upload.ACL === 'public-read') {
                    expect(['image/png', 'image/jpeg'], 'Public image').toContain(upload.ContentType);
                    expect(upload.Key, 'Public image').not.toMatch(/\.svg$/);
                } else {
                    expect(upload.ACL).toBe('private');
                    expect(upload.ContentDisposition).toBe('attachment');
                }
            }
        };

        test('An svg that claims to be a png is still rasterized, and never served as an svg', async () => {
            await uploadImage({ filename: 'logo.png', contentType: 'image/png', content: svgContent });

            expectNoPublicSvg();
            expect(uploads[0]).toMatchObject({ ContentType: 'image/png', ACL: 'public-read' });

            // The uploaded bytes are only kept as a private source object
            expect(uploads[1]).toMatchObject({ ContentDisposition: 'attachment', ACL: 'private' });
        });

        test('A png that claims to be an svg is stored as the private source it is', async () => {
            await uploadImage({ filename: 'logo.svg', contentType: 'image/svg+xml', content: pngContent });

            expectNoPublicSvg();
            expect(uploads[0]).toMatchObject({ ContentType: 'image/png', ACL: 'public-read' });
            expect(uploads[1]).toMatchObject({ ContentType: 'image/svg+xml', ContentDisposition: 'attachment', ACL: 'private' });
        });

        test('An upload that is not an image at all never reaches the file server publicly', async () => {
            await expectRejectedOrSafe(uploadImage({ filename: 'evil.png', contentType: 'image/png', content: htmlContent }));
            expectNoPublicSvg();

            for (const upload of uploads) {
                expect(upload.ACL).not.toBe('public-read');
            }
        });

        test('Without resolutions nothing is rasterized, so nothing may become public', async () => {
            // This is the only path where the bytes we store are the bytes that were uploaded
            for (const attack of [
                { filename: 'evil.svg', contentType: 'image/svg+xml', content: svgContent },
                { filename: 'evil.png', contentType: 'image/png', content: htmlContent },
                { filename: 'evil.png', contentType: 'image/png', content: svgContent },
            ]) {
                uploads = [];

                await expectRejectedOrSafe(uploadImage({ ...attack, resolutions: [] }));

                expect(uploads.length, attack.filename).toBeLessThanOrEqual(1);
                expectNoPublicSvg();
            }
        });

        test('A resolution we cannot generate never results in a public object', async () => {
            for (const resolution of [
                { width: -1, height: -1, fit: 'inside' },
                { width: 0, height: 0, fit: 'inside' },
                { width: 100000, height: 100000, fit: 'inside' },
            ]) {
                uploads = [];

                await expectRejectedOrSafe(uploadImage({ filename: 'logo.png', contentType: 'image/png', content: pngContent, resolutions: [resolution] }));
                expectNoPublicSvg();

                // A resolution we can't generate never leaves a half finished image behind
                expect(uploads.length, JSON.stringify(resolution)).toBeLessThanOrEqual(2);
            }
        });

        test('An image endpoint upload never gets an inline disposition it did not earn', async () => {
            await uploadImage({ filename: 'logo.svg', contentType: 'image/svg+xml', content: svgContent });

            expect(uploads).toHaveLength(2);

            for (const upload of uploads) {
                expect(upload.ContentDisposition).not.toBe('inline');
            }
        });
    });

    describe('Signed urls', () => {
        let originalClient: S3Client;

        beforeEach(() => {
            originalClient = FileSignService.s3;
            FileSignService.s3 = new S3Client({
                forcePathStyle: false,
                endpoint: 'https://test.digitaloceanspaces.com',
                credentials: {
                    accessKeyId: 'test-key',
                    secretAccessKey: 'test-secret',
                },
                region: 'eu-west-1',
            });
        });

        afterEach(() => {
            FileSignService.s3 = originalClient;
        });

        const getDisposition = async (data: { path: string; contentType?: string | null }) => {
            const file = new File({
                id: '1c9ab9e6-1234-4c5e-9f1a-000000000000',
                server: 'https://test-bucket.test.digitaloceanspaces.com',
                path: data.path,
                size: 100,
                isPrivate: true,
                contentType: data.contentType ?? null,
            });

            const signed = await FileSignService.withSignedUrl(file);
            expect(signed?.signedUrl, data.path).toBeDefined();

            return new URL(signed!.signedUrl!).searchParams.get('response-content-disposition');
        };

        test('A dangerous path is downloaded, whatever the content type of the struct claims', async () => {
            const attacks = [
                { path: 'test/users/1/a/evil.svg' },
                { path: 'test/users/1/a/evil.svg', contentType: 'application/pdf' },
                { path: 'test/users/1/a/evil.svg', contentType: 'image/png' },
                { path: 'test/users/1/a/evil.html', contentType: 'application/pdf' },
                { path: 'test/users/1/a/evil.xhtml', contentType: 'image/jpeg' },
                { path: 'test/users/1/a/evil.js', contentType: 'application/pdf' },
                { path: 'test/users/1/a/evil.php', contentType: 'application/pdf' },
                { path: 'test/users/1/a/evil', contentType: 'application/pdf' },
                { path: 'test/users/1/a/evil.', contentType: 'application/pdf' },
                { path: 'test/users/1/a.pdf/evil.svg' },
                { path: 'test/invoices/1c9ab9e6.xml', contentType: 'application/xml' },

                // Casing and whitespace around the extension may not hide it
                { path: 'test/users/1/a/EVIL.SVG', contentType: 'application/pdf' },
                { path: 'test/users/1/a/evil.SvG' },
                { path: 'test/users/1/a/evil.svg ', contentType: 'application/pdf' },

                // A path we could never generate is refused instead of guessed
                { path: '', contentType: 'application/pdf' },
                { path: 'test/users/1/a/', contentType: 'application/pdf' },
            ];

            for (const attack of attacks) {
                expect(await getDisposition(attack), JSON.stringify(attack)).toBe('attachment');
            }
        });

        test('A dangerous content type is downloaded, whatever the path claims', async () => {
            for (const contentType of executableContentTypes) {
                expect(await getDisposition({ path: 'test/users/1/a/invoice.pdf', contentType }), contentType).toBe('attachment');
                expect(await getDisposition({ path: 'test/users/1/a/photo.png', contentType }), contentType).toBe('attachment');
            }
        });

        test('Only a real pdf or raster image is rendered', async () => {
            expect(await getDisposition({ path: 'test/users/1/a/invoice.pdf', contentType: 'application/pdf' })).toBe('inline');
            expect(await getDisposition({ path: 'test/users/1/a/photo.jpg', contentType: 'image/jpeg' })).toBe('inline');

            // Files we generate ourselves don't carry a content type
            expect(await getDisposition({ path: 'test/p/1/a.png' })).toBe('inline');
            expect(await getDisposition({ path: 'test/p/1/A.PDF' })).toBe('inline');

            // An office document is never rendered, even though we accept the upload
            expect(await getDisposition({ path: 'test/users/1/a/report.docx', contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })).toBe('attachment');
            expect(await getDisposition({ path: 'test/users/1/a/notes.txt', contentType: 'text/plain' })).toBe('attachment');
        });

        test('The disposition is signed, so a client cannot change or strip it', async () => {
            const file = new File({
                id: '1c9ab9e6-1234-4c5e-9f1a-000000000000',
                server: 'https://test-bucket.test.digitaloceanspaces.com',
                path: 'test/users/1/a/report.docx',
                size: 100,
                isPrivate: true,
                contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            });

            // Sign the same file twice, once with the disposition we would refuse, until both urls carry the
            // same timestamp: only the disposition differs between them
            let attachment: URL;
            let inline: URL;
            let attempts = 0;

            do {
                attachment = new URL((await FileSignService.withSignedUrl(file))!.signedUrl!);

                const spy = vi.spyOn(FileSignService, 'getContentDisposition').mockReturnValue('inline');
                inline = new URL((await FileSignService.withSignedUrl(file))!.signedUrl!);
                spy.mockRestore();

                attempts++;
            } while (attachment.searchParams.get('X-Amz-Date') !== inline.searchParams.get('X-Amz-Date') && attempts < 5);

            expect(attachment.searchParams.get('response-content-disposition')).toBe('attachment');
            expect(inline.searchParams.get('response-content-disposition')).toBe('inline');

            // The disposition is part of what is signed, so a client can't turn a download into a render by
            // editing the url: the signature no longer matches
            expect(attachment.searchParams.get('X-Amz-Signature')).toBeTruthy();
            expect(inline.searchParams.get('X-Amz-Signature')).not.toBe(attachment.searchParams.get('X-Amz-Signature'));
        });

        test('The keys we generate can never contain something the extension check would misread', async () => {
            // getContentDisposition() reads the extension of the path, so our keys may never contain a
            // query string, a fragment or a second extension
            const response = await uploadFile({ filename: 'evil.svg?x=.pdf#.pdf', contentType: 'application/pdf' });

            expect(response.body.path).not.toContain('?');
            expect(response.body.path).not.toContain('#');
            expect(response.body.path).toMatch(/^test\/p\/[a-z0-9-]+\/[a-z0-9-]+\.pdf$/);
            expect(await getDisposition({ path: response.body.path, contentType: response.body.contentType })).toBe('inline');
        });
    });
});
