import { ObjectData } from '@simonbackx/simple-encoding';

import { Version } from '../Version.js';
import { File, FileTypes, supportedFileTypes, supportedImageTypes } from './File.js';

describe('File', () => {
    describe('url validation', () => {
        const buildFileData = (server: string, extra: Record<string, unknown> = {}) => {
            return new ObjectData({
                id: 'aa2b7bd0-1234-4c5e-9f1a-000000000000',
                server,
                path: 'p/aa2b7bd0/contract.pdf',
                size: 100,
                ...extra,
            }, { version: Version });
        };

        test('It refuses a url a browser would run as code', () => {
            // We render a file as a link and as the source of an image, so these would run on our own domain
            for (const server of [
                'javascript:alert(document.domain)',
                'JavaScript:alert(1)',
                'java\tscript:alert(1)',
                'data:text/html,<script>alert(1)</script>',
                'vbscript:msgbox(1)',
                'file:///etc/passwd',
                'blob:https://example.com/1234',
            ]) {
                expect(() => File.decode(buildFileData(server)), server).toThrow(/url/i);
            }
        });

        test('It refuses anything that is not an absolute url', () => {
            for (const server of ['', ' ', 'test.com', 'files.stamhoofd.be/p', '/relative/path', '//evil.com', 'https://']) {
                expect(() => File.decode(buildFileData(server)), server).toThrow(/url/i);
            }
        });

        test('It accepts the url of a file server', () => {
            expect(File.decode(buildFileData('https://bucket.ams3.digitaloceanspaces.com')).server).toBe('https://bucket.ams3.digitaloceanspaces.com');

            // Development file servers are not always https
            expect(File.decode(buildFileData('http://localhost:9000')).server).toBe('http://localhost:9000');
        });

        test('It refuses to encode a file we could never build a url for', () => {
            // Without this, a file that got into the database before we validated it would keep being served
            const file = new File({
                id: 'aa2b7bd0-1234-4c5e-9f1a-000000000000',
                server: 'javascript:alert(document.domain)',
                path: 'contract.pdf',
                size: 100,
            });

            expect(() => file.encode({ version: Version })).toThrow(/url/i);
        });

        test('It refuses a signed url that is not a plain http url', () => {
            const file = new File({
                id: 'aa2b7bd0-1234-4c5e-9f1a-000000000000',
                server: 'https://bucket.ams3.digitaloceanspaces.com',
                path: 'p/aa2b7bd0/contract.pdf',
                size: 100,
                isPrivate: true,
                signature: 'signature',
                signedUrl: 'javascript:alert(document.domain)',
            });

            expect(() => file.encode({ version: Version })).toThrow(/url/i);
            expect(() => file.validateUrls()).toThrow(/url/i);
        });

        test('The path can never point at another server', () => {
            const file = File.decode(buildFileData('https://bucket.ams3.digitaloceanspaces.com', { path: '../../evil' }));

            // A path is always appended to the server, so it stays on it
            expect(new URL(file.getPublicPath()).origin).toBe('https://bucket.ams3.digitaloceanspaces.com');
        });
    });

    describe('resolveUploadType', () => {
        test('It keeps supported content types, and the extension the file was uploaded with', () => {
            expect(File.resolveUploadType({ contentType: 'application/pdf', filename: 'contract.pdf' })).toEqual({
                contentType: 'application/pdf',
                extension: 'pdf',
                canRenderInline: true,
            });

            // Not renamed to .jpg: both extensions belong to the same content type
            expect(File.resolveUploadType({ contentType: 'image/jpeg', filename: 'photo.jpeg' })).toEqual({
                contentType: 'image/jpeg',
                extension: 'jpeg',
                canRenderInline: true,
            });
        });

        test('It renames a file that was uploaded with the extension of another content type', () => {
            // Users do rename a jpg to .png, and the content type describes the file better than its name
            expect(File.resolveUploadType({ contentType: 'image/jpeg', filename: 'photo.png' })).toEqual({
                contentType: 'image/jpeg',
                extension: 'jpg',
                canRenderInline: true,
            });

            expect(File.resolveUploadType({ contentType: 'application/pdf', filename: 'document.docx' })).toEqual({
                contentType: 'application/pdf',
                extension: 'pdf',
                canRenderInline: true,
            });
        });

        test('It normalizes alternative content types, casing and parameters', () => {
            expect(File.resolveUploadType({ contentType: 'IMAGE/JPG', filename: 'photo.JPG' })).toEqual({
                contentType: 'image/jpeg',
                extension: 'jpg',
                canRenderInline: true,
            });

            expect(File.resolveUploadType({ contentType: 'text/csv; charset=utf-8', filename: 'members.csv' })).toEqual({
                contentType: 'text/csv',
                extension: 'csv',
                canRenderInline: false,
            });
        });

        test('It falls back to a trusted extension when the content type is not usable', () => {
            // Browsers and operating systems often report this for files they don't recognize
            expect(File.resolveUploadType({ contentType: 'application/octet-stream', filename: 'report.docx' })).toEqual({
                contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                extension: 'docx',
                canRenderInline: false,
            });

            expect(File.resolveUploadType({ contentType: null, filename: 'sheet.xlsx' })).toEqual({
                contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                extension: 'xlsx',
                canRenderInline: false,
            });
        });

        test('An unsupported content type is never used, not even to reject a safe extension', () => {
            expect(File.resolveUploadType({ contentType: 'text/html', filename: 'invoice.pdf' })).toEqual({
                contentType: 'application/pdf',
                extension: 'pdf',
                canRenderInline: true,
            });

            // The file is stored and served as a pdf, so a browser never gets to run what is inside it
            expect(File.resolveUploadType({ contentType: 'image/svg+xml', filename: 'drawing.png' })).toEqual({
                contentType: 'image/png',
                extension: 'png',
                canRenderInline: true,
            });
        });

        test('It rejects content types that browsers could execute', () => {
            expect(File.resolveUploadType({ contentType: 'text/html', filename: 'evil.html' })).toBeNull();
            expect(File.resolveUploadType({ contentType: 'image/svg+xml', filename: 'evil.svg' })).toBeNull();
            expect(File.resolveUploadType({ contentType: 'application/xhtml+xml', filename: 'evil.xhtml' })).toBeNull();
            expect(File.resolveUploadType({ contentType: 'text/javascript', filename: 'evil.js' })).toBeNull();
            expect(File.resolveUploadType({ contentType: 'text/xml', filename: 'evil.xml' })).toBeNull();
        });

        test('It rejects a file we cannot recognize at all', () => {
            expect(File.resolveUploadType({ contentType: 'application/octet-stream', filename: 'backup.bin' })).toBeNull();
            expect(File.resolveUploadType({ contentType: null, filename: 'no-extension' })).toBeNull();
            expect(File.resolveUploadType({ contentType: null, filename: null })).toBeNull();
            expect(File.resolveUploadType({})).toBeNull();
        });

        test('It only looks at the last extension of a filename', () => {
            expect(File.resolveUploadType({ contentType: 'text/html', filename: 'evil.html.pdf' })).toEqual({
                contentType: 'application/pdf',
                extension: 'pdf',
                canRenderInline: true,
            });

            // Neither the content type nor the html extension is supported
            expect(File.resolveUploadType({ contentType: 'text/html', filename: 'evil.pdf.html' })).toBeNull();

            // The file is always stored with the extension of the resolved content type, so an unsupported
            // extension never survives an upload
            expect(File.resolveUploadType({ contentType: 'application/pdf', filename: 'invoice.pdf.html' })).toEqual({
                contentType: 'application/pdf',
                extension: 'pdf',
                canRenderInline: true,
            });
        });
    });

    describe('supportedImageTypes', () => {
        test('It accepts the image types we can generate resolutions from', () => {
            expect(supportedImageTypes.resolveUpload({ contentType: 'image/png', filename: 'logo.png' })).toEqual({
                contentType: 'image/png',
                extension: 'png',
                canRenderInline: true,
            });

            // Capacitor and some browsers upload images without a usable filename
            expect(supportedImageTypes.resolveUpload({ contentType: 'image/jpeg', filename: 'blob' })).toEqual({
                contentType: 'image/jpeg',
                extension: 'jpg',
                canRenderInline: true,
            });
        });

        test('It accepts svg, which is only safe because we never serve the uploaded image itself', () => {
            expect(supportedImageTypes.resolveUpload({ contentType: 'image/svg+xml', filename: 'logo.svg' })).toEqual({
                contentType: 'image/svg+xml',
                extension: 'svg',
                canRenderInline: false,
            });

            // ... while an svg can never be uploaded as a normal file
            expect(File.resolveUploadType({ contentType: 'image/svg+xml', filename: 'logo.svg' })).toBeNull();
        });

        test('It refuses anything that is not an image', () => {
            expect(supportedImageTypes.resolveUpload({ contentType: 'text/html', filename: 'evil.html' })).toBeNull();
            expect(supportedImageTypes.resolveUpload({ contentType: 'application/pdf', filename: 'document.pdf' })).toBeNull();
            expect(supportedImageTypes.resolveUpload({ contentType: 'application/octet-stream', filename: 'photo' })).toBeNull();
        });
    });

    describe('canRenderInline', () => {
        test('Only file types a browser cannot execute may be rendered', () => {
            const canRenderInline = (contentType: string) => File.resolveUploadType({ contentType })?.canRenderInline;

            expect(canRenderInline('application/pdf')).toBe(true);
            expect(canRenderInline('image/png')).toBe(true);
            expect(canRenderInline('image/jpg')).toBe(true);

            // Office documents can contain macros, and a browser has no viewer for them anyway
            expect(canRenderInline('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe(false);
            expect(canRenderInline('text/plain')).toBe(false);
            expect(canRenderInline('text/csv')).toBe(false);

            // An svg can contain scripts, so it is never rendered - not even as an image
            expect(supportedImageTypes.resolveUpload({ contentType: 'image/svg+xml' })?.canRenderInline).toBe(false);
        });
    });

    describe('acceptAttribute', () => {
        test('It offers both the extensions and the content types we accept', () => {
            const accept = supportedFileTypes.acceptAttribute.split(',');

            expect(accept).toContain('.pdf');
            expect(accept).toContain('.jpeg');
            expect(accept).toContain('application/pdf');
            expect(accept).not.toContain('.svg');
            expect(accept).not.toContain('text/html');
        });
    });

    describe('FileTypes', () => {
        test('It refuses definitions that would silently overrule each other', () => {
            expect(() => new FileTypes([
                { contentType: 'application/pdf', extensions: ['pdf'] },
                { contentType: 'application/x-pdf', extensions: ['pdf'] },
            ])).toThrow(/duplicate extension/i);

            expect(() => new FileTypes([
                { contentType: 'application/pdf', extensions: ['pdf'] },
                { contentType: 'image/png', extensions: ['png'], alternativeContentTypes: ['APPLICATION/PDF'] },
            ])).toThrow(/duplicate content type/i);
        });
    });

    describe('removeExtension', () => {
        test('It removes the extension, but keeps filenames without one', () => {
            expect(File.removeExtension('my.file.pdf')).toBe('my.file');
            expect(File.removeExtension('no-extension')).toBe('no-extension');
            expect(File.removeExtension('.hidden')).toBe('');
        });
    });
});
