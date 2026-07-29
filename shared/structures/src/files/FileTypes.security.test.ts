import type { FileTypeDefinition, ResolvedFileType } from './File.js';
import { File, FileTypes, supportedFileTypes, supportedImageTypes } from './File.js';

/**
 * Adversarial tests for the upload allowlist.
 *
 * An uploaded file is served back from one of our own domains, so the content type we store it with decides
 * whether a browser executes it there. Everything in this file tries to smuggle an executable content type or
 * extension past {@link FileTypes.resolveUpload}.
 */

/**
 * The only content types a browser may render inline: a pdf is opened in the pdf viewer, which has no access
 * to the page it is on, and browsers only ever sniff an image as another image type.
 */
const inlineSafeContentTypes = new Set([
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/heic',
    'image/heif',
]);

/**
 * Content types that make a browser execute what is inside the file, on the domain it is served from
 */
const executableContentTypes = [
    'text/html',
    'TEXT/HTML',
    'text/html; charset=utf-8',
    'application/xhtml+xml',
    'image/svg+xml',
    'image/svg',
    'image/svg+xml; charset=utf-8',
    'text/xml',
    'application/xml',
    'application/xslt+xml',
    'text/javascript',
    'application/javascript',
    'application/x-javascript',
    'application/ecmascript',
    'application/wasm',
    'application/x-httpd-php',
    'application/x-php',
    'text/php',
    'application/x-shockwave-flash',
    'text/vtt',
    'message/rfc822',
    'multipart/related',
    'application/x-msdownload',
    'application/x-sh',
    'text/vbscript',
];

/**
 * Extensions a file server or a browser could treat as something executable
 */
const executableExtensions = [
    'html',
    'htm',
    'xhtml',
    'shtml',
    'svg',
    'svgz',
    'js',
    'mjs',
    'wasm',
    'php',
    'php5',
    'phtml',
    'jsp',
    'asp',
    'aspx',
    'htaccess',
    'xml',
    'xsl',
    'swf',
    'vtt',
    'eml',
    'mhtml',
    'sh',
    'exe',
];

const findDefinition = (types: FileTypes, contentType: string): FileTypeDefinition | undefined => {
    return types.definitions.find(definition => definition.contentType === contentType);
};

/**
 * The invariants that have to hold for every accepted upload, whatever was reported for it:
 * the stored content type comes from the allowlist, the stored extension belongs to that content type, and
 * only file types a browser cannot execute may be rendered.
 */
const expectSafeResolution = (types: FileTypes, resolved: ResolvedFileType | null, description: string) => {
    if (resolved === null) {
        return;
    }

    const definition = findDefinition(types, resolved.contentType);

    // The stored content type is always one of our own literals, never a string built from the upload
    expect(definition, 'Content type is not on the allowlist for ' + description).toBeDefined();
    expect(definition!.extensions, 'Extension does not belong to the content type for ' + description).toContain(resolved.extension);
    expect(resolved.canRenderInline).toBe(definition!.canRenderInline ?? false);

    // The extension ends up in an object key and in the filename we store, so it can never carry anything else
    expect(resolved.extension, 'Unsafe extension for ' + description).toMatch(/^[a-z0-9]+$/);

    if (resolved.canRenderInline) {
        expect([...inlineSafeContentTypes], 'A browser may render ' + description).toContain(resolved.contentType);
    }
};

describe('FileTypes security', () => {
    describe('The invariants used in this file', () => {
        test('They fail on a resolution that would let a browser execute an upload', () => {
            // Without this, every test below would silently pass if resolveUpload stopped filtering anything
            const unsafe = new FileTypes([
                { contentType: 'text/html', extensions: ['html'], canRenderInline: true },
            ]);

            expect(() => expectSafeResolution(unsafe, unsafe.resolveUpload({ filename: 'evil.html' }), 'evil.html')).toThrow();
        });

        test('They fail on a content type that is not on the allowlist', () => {
            expect(() => expectSafeResolution(supportedFileTypes, { contentType: 'text/html', extension: 'html', canRenderInline: false }, 'forged')).toThrow();

            // ... and on an extension that does not belong to the resolved content type
            expect(() => expectSafeResolution(supportedFileTypes, { contentType: 'application/pdf', extension: 'html', canRenderInline: true }, 'forged')).toThrow();
        });
    });

    describe('The allowlists themselves', () => {
        test('A file type is only rendered inline when a browser cannot execute it', () => {
            for (const types of [supportedFileTypes, supportedImageTypes]) {
                for (const definition of types.definitions) {
                    if (definition.canRenderInline) {
                        expect([...inlineSafeContentTypes]).toContain(definition.contentType);
                    }
                }
            }
        });

        test('An svg is never rendered inline, not even as an image', () => {
            const svg = findDefinition(supportedImageTypes, 'image/svg+xml');
            expect(svg).toBeDefined();
            expect(svg!.canRenderInline ?? false).toBe(false);

            // ... and it is not a file type at all
            expect(findDefinition(supportedFileTypes, 'image/svg+xml')).toBeUndefined();
        });

        test('No allowlist contains a content type or extension a browser could execute', () => {
            const allContentTypes = [supportedFileTypes, supportedImageTypes].flatMap(types =>
                types.definitions.flatMap(definition => [definition.contentType, ...(definition.alternativeContentTypes ?? [])]),
            );

            for (const contentType of executableContentTypes) {
                // svg is the documented exception for images: the uploaded svg itself is never served
                if (contentType.startsWith('image/svg')) {
                    expect(supportedFileTypes.definitions.flatMap(d => [d.contentType, ...(d.alternativeContentTypes ?? [])])).not.toContain(contentType);
                    continue;
                }
                expect(allContentTypes).not.toContain(contentType.toLowerCase());
            }

            const fileExtensions = supportedFileTypes.definitions.flatMap(definition => definition.extensions);
            for (const extension of executableExtensions) {
                expect(fileExtensions).not.toContain(extension);
            }
        });

        test('The accept attribute never offers a file type we would refuse', () => {
            for (const types of [supportedFileTypes, supportedImageTypes]) {
                for (const entry of types.acceptAttribute.split(',')) {
                    const resolved = entry.startsWith('.')
                        ? types.resolveUpload({ filename: 'file' + entry })
                        : types.resolveUpload({ contentType: entry });

                    expect(resolved, 'Accepted but not resolvable: ' + entry).not.toBeNull();
                    expectSafeResolution(types, resolved, entry);
                }
            }
        });
    });

    describe('Content type spoofing', () => {
        /**
         * Everything a client could report as the content type of its upload
         */
        const contentTypes: (string | null | undefined)[] = [
            'application/pdf',
            'APPLICATION/PDF',
            'Application/Pdf',
            '  application/pdf  ',
            'application/pdf; charset=utf-8',
            'application/pdf;charset=utf-8; boundary=x',
            'application/pdf;',
            ';application/pdf',
            'application/pdf, text/html',
            'text/html, application/pdf',
            'application/pdf\r\nX-Injected: 1',
            'application/pdf\nContent-Disposition: inline',
            'application/pdf"',
            'application/pdf/../text/html',
            'text/html',
            'image/svg+xml',
            'text/javascript',
            'application/octet-stream',
            'application/x-msdownload',
            '*/*',
            '*',
            '',
            '   ',
            '\t\n',
            'image/jpg',
            'IMAGE/JPG; charset=binary',
            null,
            undefined,
        ];

        /**
         * Everything a client could report as the filename of its upload
         */
        const filenames: (string | null | undefined)[] = [
            'invoice.pdf',
            'INVOICE.PDF',
            'invoice.pdf ',
            'invoice.pdf.',
            'invoice.pdf..',
            'evil.pdf.html',
            'evil.html.pdf',
            'evil.html',
            'evil.svg',
            'evil.js',
            'evil.wasm',
            'evil.php',
            'evil.jsp',
            'evil.xml',
            '.htaccess',
            'noextension',
            '',
            '.pdf',
            '..',
            '...',
            '../../etc/passwd',
            '..\\..\\evil.html',
            '/etc/passwd',
            'folder.pdf/evil.html',
            'folder.html/invoice.pdf',
            'evil.html\u0000.pdf',
            'evil.html .pdf',
            'evil.pdf\u0000',
            'evil.pdf ',
            'evil\r\n.pdf',
            'a'.repeat(4000) + '.pdf',
            '‮fdp.html',
            '你好.pdf',
            'photo.JPEG',
            null,
            undefined,
        ];

        test('Every combination of a reported content type and filename resolves to something safe', () => {
            let accepted = 0;

            for (const contentType of contentTypes) {
                for (const filename of filenames) {
                    const description = JSON.stringify({ contentType, filename });

                    const asFile = supportedFileTypes.resolveUpload({ contentType, filename });
                    expectSafeResolution(supportedFileTypes, asFile, description);

                    const asImage = supportedImageTypes.resolveUpload({ contentType, filename });
                    expectSafeResolution(supportedImageTypes, asImage, description);

                    if (asFile !== null) {
                        accepted++;
                    }
                }
            }

            // Make sure the matrix isn't trivially green because everything was refused
            expect(accepted).toBeGreaterThan(0);
        });

        test('A content type is only used when it matches the allowlist exactly, after normalization', () => {
            // Anything else in the header falls back to the extension, so a smuggled value is never stored
            expect(File.resolveUploadType({ contentType: 'application/pdf\r\nX-Injected: 1', filename: 'notes.txt' })?.contentType).toBe('text/plain');
            expect(File.resolveUploadType({ contentType: 'application/pdf, text/html', filename: 'notes.txt' })?.contentType).toBe('text/plain');
            expect(File.resolveUploadType({ contentType: 'application/pdf/../text/html', filename: 'notes.txt' })?.contentType).toBe('text/plain');
            expect(File.resolveUploadType({ contentType: '*/*', filename: 'notes.txt' })?.contentType).toBe('text/plain');
            expect(File.resolveUploadType({ contentType: '   ', filename: 'notes.txt' })?.contentType).toBe('text/plain');

            // Only parameters and casing are dropped
            expect(File.resolveUploadType({ contentType: 'APPLICATION/PDF; charset=utf-8', filename: 'notes.txt' })?.contentType).toBe('application/pdf');
        });

        test('An executable content type never survives, whatever the filename says', () => {
            for (const contentType of executableContentTypes) {
                for (const filename of ['evil.html', 'evil.svg', 'invoice.pdf', 'photo.png', 'noextension', '']) {
                    const resolved = File.resolveUploadType({ contentType, filename });
                    const description = contentType + ' as ' + filename;

                    expectSafeResolution(supportedFileTypes, resolved, description);
                    expect(resolved?.contentType, description).not.toBe(contentType.split(';')[0].trim().toLowerCase());
                }
            }
        });

        test('An executable extension never survives, whatever the content type says', () => {
            for (const extension of executableExtensions) {
                for (const contentType of ['application/pdf', 'image/png', 'application/octet-stream', 'text/html', '']) {
                    const resolved = File.resolveUploadType({ contentType, filename: 'evil.' + extension });
                    const description = contentType + ' as evil.' + extension;

                    expectSafeResolution(supportedFileTypes, resolved, description);
                    expect(resolved?.extension, description).not.toBe(extension);
                }
            }
        });

        test('A polyglot that claims to be a safe type is still only served as that safe type', () => {
            // The bytes are html, but nothing about the content decides how we serve it
            expect(File.resolveUploadType({ contentType: 'application/pdf', filename: 'polyglot.html' })).toEqual({
                contentType: 'application/pdf',
                extension: 'pdf',
                canRenderInline: true,
            });

            expect(File.resolveUploadType({ contentType: 'image/png', filename: 'polyglot.svg' })).toEqual({
                contentType: 'image/png',
                extension: 'png',
                canRenderInline: true,
            });
        });

        test('Only the last extension of a filename is ever used', () => {
            for (const filename of ['evil.pdf.html', 'evil.pdf.svg', 'evil.pdf.php', 'a.b.c.d.html']) {
                expect(File.resolveUploadType({ filename }), filename).toBeNull();
            }

            // A dangerous extension in the middle is dropped: the file is stored with the resolved extension
            expect(File.resolveUploadType({ contentType: 'application/pdf', filename: 'evil.html.pdf' })?.extension).toBe('pdf');
            expect(File.resolveUploadType({ filename: 'evil.php.pdf' })?.extension).toBe('pdf');
        });

        test('A directory with a dot in a path is never mistaken for an extension', () => {
            expect(File.resolveUploadType({ filename: 'invoice.pdf/evil.html' })).toBeNull();
            expect(File.resolveUploadType({ filename: 'invoice.pdf/evil' })).toBeNull();
            expect(File.resolveUploadType({ filename: 'evil.html/invoice.pdf' })?.contentType).toBe('application/pdf');
        });

        test('A filename we cannot read an extension from is refused without a content type', () => {
            for (const filename of ['', '..', '...', 'noextension', 'trailing.', 'trailing. ', 'evil.pdf\u0000', '‮fdp.html']) {
                expect(File.resolveUploadType({ filename }), filename).toBeNull();
                expect(File.resolveUploadType({ contentType: 'application/octet-stream', filename }), filename).toBeNull();
            }
        });

        test('Whitespace and casing around an extension are normalized instead of stored', () => {
            for (const filename of ['invoice.pdf ', 'invoice.PDF', 'invoice. PDF ', 'invoice.Pdf']) {
                expect(File.resolveUploadType({ filename }), filename).toEqual({
                    contentType: 'application/pdf',
                    extension: 'pdf',
                    canRenderInline: true,
                });
            }
        });
    });

    describe('Image uploads', () => {
        test('Nothing that is not an image is ever accepted as an image', () => {
            for (const contentType of executableContentTypes) {
                if (contentType.startsWith('image/svg')) {
                    continue;
                }
                for (const filename of ['evil.html', 'evil.svg', 'logo.png', '']) {
                    const resolved = supportedImageTypes.resolveUpload({ contentType, filename });
                    expectSafeResolution(supportedImageTypes, resolved, contentType + ' as ' + filename);
                }
            }

            expect(supportedImageTypes.resolveUpload({ contentType: 'application/pdf', filename: 'invoice.pdf' })).toBeNull();
            expect(supportedImageTypes.resolveUpload({ contentType: 'text/plain', filename: 'notes.txt' })).toBeNull();
            expect(supportedImageTypes.resolveUpload({ contentType: 'image/tiff', filename: 'photo.tiff' })).toBeNull();
        });

        test('An svg is accepted as an image, but never as something a browser may render', () => {
            for (const contentType of ['image/svg+xml', 'image/svg', 'IMAGE/SVG+XML', 'image/svg+xml; charset=utf-8']) {
                const resolved = supportedImageTypes.resolveUpload({ contentType, filename: 'logo.svg' });

                expect(resolved, contentType).toEqual({
                    contentType: 'image/svg+xml',
                    extension: 'svg',
                    canRenderInline: false,
                });

                // The same upload is always refused as a normal file
                expect(File.resolveUploadType({ contentType, filename: 'logo.svg' }), contentType).toBeNull();
            }
        });

        test('An svg that claims to be a raster image is stored as that raster image', () => {
            // The content type decides, and every resolution we serve is generated by sharp anyway
            expect(supportedImageTypes.resolveUpload({ contentType: 'image/png', filename: 'evil.svg' })).toEqual({
                contentType: 'image/png',
                extension: 'png',
                canRenderInline: true,
            });
        });
    });

    describe('FileTypes definitions', () => {
        test('It refuses an allowlist where an alternative content type shadows another type', () => {
            expect(() => new FileTypes([
                { contentType: 'image/png', extensions: ['png'] },
                { contentType: 'text/html', extensions: ['html'], alternativeContentTypes: ['image/png'] },
            ])).toThrow(/duplicate content type/i);

            expect(() => new FileTypes([
                { contentType: 'image/png', extensions: ['png'], alternativeContentTypes: ['image/x-png'] },
                { contentType: 'image/gif', extensions: ['gif'], alternativeContentTypes: ['IMAGE/X-PNG'] },
            ])).toThrow(/duplicate content type/i);
        });

        test('An extension only ever resolves to the content type it is registered for', () => {
            for (const types of [supportedFileTypes, supportedImageTypes]) {
                for (const definition of types.definitions) {
                    for (const extension of definition.extensions) {
                        const resolved = types.resolveUpload({ filename: 'file.' + extension });

                        expect(resolved?.contentType, extension).toBe(definition.contentType);
                        expect(resolved?.extension, extension).toBe(extension);
                    }
                }
            }
        });
    });
});
