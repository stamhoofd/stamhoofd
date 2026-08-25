import type { Data, Encodeable, EncodeContext } from '@simonbackx/simple-encoding';
import { EncodeMedium } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { AuditLogReplacement, AuditLogReplacementType } from '../AuditLogReplacement.js';

export type FileTypeDefinition = {
    /**
     * The content type we store and serve files of this type with.
     */
    contentType: string;

    /**
     * Extensions that belong to this content type. The first one is the extension we use when storing a file.
     */
    extensions: [string, ...string[]];

    /**
     * Other content types browsers and operating systems use for this file type. These are all replaced with
     * the canonical content type above.
     */
    alternativeContentTypes?: string[];

    /**
     * Whether a browser may render this file type instead of downloading it.
     *
     * Only enable this for file types a browser can't execute: an uploaded file is served from one of our own
     * domains, so anything a browser runs (html, svg, ...) would run there too.
     */
    canRenderInline?: boolean;
};

export type ResolvedFileType = {
    contentType: string;
    extension: string;
    canRenderInline: boolean;
};

/**
 * Drops parameters (e.g. `; charset=utf-8`) and normalizes casing and whitespace
 */
function normalizeContentType(contentType: string): string {
    return contentType.split(';')[0].trim().toLowerCase();
}

/**
 * Parses a url we'll hand to a browser, and throws when it is not a plain http(s) url.
 *
 * Schemes like `javascript:`, `data:` and `vbscript:` are code as soon as a browser opens them, so they may
 * never end up in a link or an image we render.
 */
function validateHttpUrl(value: string, field: string): URL {
    let url: URL;

    try {
        url = new URL(value);
    } catch {
        throw new SimpleError({
            code: 'invalid_field',
            message: 'Invalid url for a file: ' + value,
            human: $t('%ZhU'),
            field,
        });
    }

    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
        throw new SimpleError({
            code: 'invalid_field',
            message: 'A file url can only be http or https, received: ' + url.protocol,
            human: $t('%ZhU'),
            field,
        });
    }

    return url;
}

/**
 * Returns the lowercased extension of a filename or path, without the dot, or null if it doesn't have one.
 */
function getFilenameExtension(filename: string): string | null {
    // Only look at the filename itself: a directory in the path can contain dots too
    const basename = filename.split('/').pop() ?? '';
    const parts = basename.split('.');

    if (parts.length < 2) {
        return null;
    }

    const extension = parts[parts.length - 1].trim().toLowerCase();
    return extension.length > 0 ? extension : null;
}

/**
 * An allowlist of file types, used to decide what an upload may be stored and served as.
 */
export class FileTypes {
    private readonly byContentType = new Map<string, FileTypeDefinition>();
    private readonly byExtension = new Map<string, FileTypeDefinition>();

    constructor(readonly definitions: FileTypeDefinition[]) {
        for (const definition of definitions) {
            for (const contentType of [definition.contentType, ...(definition.alternativeContentTypes ?? [])]) {
                const key = normalizeContentType(contentType);

                if (this.byContentType.has(key)) {
                    throw new Error('Duplicate content type ' + key + ' in file types');
                }
                this.byContentType.set(key, definition);
            }

            for (const extension of definition.extensions) {
                const key = extension.trim().toLowerCase();

                if (this.byExtension.has(key)) {
                    throw new Error('Duplicate extension ' + key + ' in file types');
                }
                this.byExtension.set(key, definition);
            }
        }
    }

    /**
     * The value for the accept attribute of a file input, so the file picker only offers files we accept.
     */
    get acceptAttribute(): string {
        return [
            ...this.definitions.flatMap(definition => definition.extensions.map(extension => '.' + extension)),
            ...this.definitions.map(definition => definition.contentType),
        ].join(',');
    }

    private resolveDefinition(definition: FileTypeDefinition, extension: string): ResolvedFileType {
        return {
            contentType: definition.contentType,
            extension,
            canRenderInline: definition.canRenderInline ?? false,
        };
    }

    /**
     * Determines the content type and extension we'll store an uploaded file with, or null if we don't
     * support the file type.
     *
     * The reported content type decides, because it describes the file better than its name does: users do
     * rename a jpg to .png, and we store the file with the extension of the content type we picked, so the
     * two can never contradict each other. A content type that is not in this list is never used - we only
     * fall back to the extension of the filename, which has to be in this list as well.
     */
    resolveUpload(upload: { contentType?: string | null; filename?: string | null }): ResolvedFileType | null {
        const extension = upload.filename ? getFilenameExtension(upload.filename) : null;
        const definitionFromContentType = upload.contentType ? this.byContentType.get(normalizeContentType(upload.contentType)) : undefined;
        const definitionFromExtension = extension ? this.byExtension.get(extension) : undefined;

        if (definitionFromContentType) {
            // Keep the uploaded extension when it is one of this content type, so we don't rename .jpeg to .jpg
            return this.resolveDefinition(
                definitionFromContentType,
                extension && definitionFromExtension === definitionFromContentType ? extension : definitionFromContentType.extensions[0],
            );
        }

        if (definitionFromExtension && extension) {
            return this.resolveDefinition(definitionFromExtension, extension);
        }

        return null;
    }
}

/**
 * The only file types that can be uploaded as a file.
 *
 * The content type of an upload is chosen by the uploading client, so it can never be trusted: it is stored
 * as-is and returned by our file server when the file is downloaded again. Without an allowlist, a user could
 * upload e.g. an HTML or SVG file that browsers would happily execute on one of our own domains.
 */
export const supportedFileTypes = new FileTypes([
    // A pdf is rendered by the pdf viewer of the browser, which doesn't give it access to the page it is on
    { contentType: 'application/pdf', extensions: ['pdf'], canRenderInline: true },

    // Images. Browsers only sniff images as other image types, so they can never turn into html
    { contentType: 'image/jpeg', extensions: ['jpg', 'jpeg'], alternativeContentTypes: ['image/jpg'], canRenderInline: true },
    { contentType: 'image/png', extensions: ['png'], canRenderInline: true },
    { contentType: 'image/gif', extensions: ['gif'], canRenderInline: true },
    { contentType: 'image/webp', extensions: ['webp'], canRenderInline: true },
    { contentType: 'image/heic', extensions: ['heic'], canRenderInline: true },
    { contentType: 'image/heif', extensions: ['heif'], canRenderInline: true },

    // Word
    { contentType: 'application/msword', extensions: ['doc'] },
    { contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', extensions: ['docx'] },

    // Excel
    { contentType: 'application/vnd.ms-excel', extensions: ['xls'] },
    { contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', extensions: ['xlsx'] },

    // PowerPoint
    { contentType: 'application/vnd.ms-powerpoint', extensions: ['ppt'] },
    { contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', extensions: ['pptx'] },

    // OpenDocument
    { contentType: 'application/vnd.oasis.opendocument.text', extensions: ['odt'] },
    { contentType: 'application/vnd.oasis.opendocument.spreadsheet', extensions: ['ods'] },
    { contentType: 'application/vnd.oasis.opendocument.presentation', extensions: ['odp'] },

    // Plain text
    { contentType: 'text/csv', extensions: ['csv'] },
    { contentType: 'text/plain', extensions: ['txt'] },
]);

/**
 * The only file types that can be uploaded as an image.
 *
 * SVG is only allowed here, and not as a normal file, because we never serve the uploaded image itself: all
 * the images we serve are generated with sharp (see the Image model), so they are always a png or jpeg.
 */
export const supportedImageTypes = new FileTypes([
    { contentType: 'image/png', extensions: ['png'], canRenderInline: true },
    { contentType: 'image/jpeg', extensions: ['jpg', 'jpeg'], alternativeContentTypes: ['image/jpg'], canRenderInline: true },
    { contentType: 'image/webp', extensions: ['webp'], canRenderInline: true },
    { contentType: 'image/gif', extensions: ['gif'], canRenderInline: true },

    // An svg is never rendered: we only store the uploaded svg itself, and it can contain scripts
    { contentType: 'image/svg+xml', extensions: ['svg'], alternativeContentTypes: ['image/svg'] },
]);

export class File implements Encodeable {
    id: string;

    /// Path to the server
    server: string;

    name: string | null;

    /**
     * Set by the uploader, so not trustworthy - can be used as a hint.
     */
    contentType: string | null;

    /// Path relative to the server
    path: string;

    /// file size in bytes
    size: number;

    /// private or not?
    isPrivate: boolean = false;

    /// signed url if it is a private file
    /// only filled if you have access to this file and when it has a valid signature
    signedUrl: string | null = null;

    /**
     * A signature that proves that this file was generated by the server and is trusted. Without a valid signature,
     * the backend won't return a signedUrl for accessing the file.
     */
    signature: string | null = null;

    /**
     * When using public/private keys inside the check functions, you can also only implement the check method
     * to verify signatures received from the backend.
     */
    static verifyFile: ((file: File) => Promise<boolean>) | null = null;
    static signFile: ((file: File) => Promise<void>) | null = null;
    static getWithSignedUrl: ((file: File) => Promise<File | null>) | null = null;

    constructor(data: {
        id: string;
        server: string;
        path: string;
        size: number;
        name?: string | null;
        isPrivate?: boolean;
        signedUrl?: string | null;
        signature?: string | null;
        contentType?: string | null;
    }) {
        this.id = data.id;
        this.server = data.server;
        this.path = data.path;
        this.size = data.size;
        this.name = data.name ?? null;
        this.isPrivate = data.isPrivate ?? false;
        this.signedUrl = data.signedUrl ?? null;
        this.signature = data.signature ?? null;
        this.contentType = data.contentType ?? null;
    }

    getDiffValue() {
        return AuditLogReplacement.create({
            id: this.getPublicPath(),
            value: this.name ?? undefined,
            type: AuditLogReplacementType.File,
        });
    }

    get signPayload() {
        return 'id: ' + this.id + '\n'
            + 'server: ' + this.server + '\n'
            + 'path: ' + this.path + '\n'
            + 'size: ' + this.size.toFixed(0) + '\n'
            + 'name: ' + this.name + '\n'
            + 'isPrivate: ' + (this.isPrivate ? 'true' : 'false')
            + (this.contentType ? '\ncontentType: ' + this.contentType : '');
    }

    static get signingEnabled() {
        return !!File.signFile;
    }

    async sign() {
        if (!File.signFile) {
            return false;
        }
        await File.signFile(this);
        return true;
    }

    async verify() {
        if (!this.signature) {
            return false;
        }

        if (!File.verifyFile) {
            return false;
        }

        return await File.verifyFile(this);
    }

    async withSignedUrl() {
        if (!this.signature || !this.isPrivate) {
            return null;
        }

        if (!File.getWithSignedUrl) {
            return null;
        }

        if (!await this.verify()) {
            // Never generate a signed url for an untrusted file
            return null;
        }

        return await File.getWithSignedUrl(this);
    }

    static decode(data: Data): File {
        const file = new File({
            id: data.field('id').string,
            server: data.field('server').string,
            path: data.field('path').string,
            size: data.field('size').integer,
            name: data.optionalField('name')?.string ?? null,

            isPrivate: data.optionalField('isPrivate')?.boolean ?? false,
            signedUrl: data.optionalField('signedUrl')?.string ?? null,
            signature: data.optionalField('signature')?.string ?? null,
            contentType: data.optionalField('contentType')?.string ?? null,
        });

        if (data.context.medium === EncodeMedium.Database || !file.isPrivate || !file.signature) {
            // Clear signed url that we read from the database - these won't be valid any longer
            file.signedUrl = null;
        }

        if (file.isPrivate && this.signingEnabled && (!data.context.medium || data.context.medium === EncodeMedium.Network)) {
            // A signature is required
            // Because of the sync nature of decoding, we cannot verify it here, but we need to do so when using the file
            if (!file.signature) {
                throw new SimpleError({
                    code: 'missing_signature',
                    message: 'Missing signature for private file',
                });
            }
        }

        file.validateUrls();

        return file;
    }

    /**
     * Throws when this file would build a url we can't safely use.
     *
     * A file is turned into a url (see {@link getPublicPath}) that we render as a link and as the source of an
     * image, so a url a browser treats as code - `javascript:alert(1)` - would run on the domain of whoever
     * opens it. Files also arrive from clients, which is why this runs on both decoding and encoding: a file we
     * can't build a url for is refused before it reaches the database, and can never leave it either.
     */
    validateUrls() {
        const server = validateHttpUrl(this.server, 'server');

        // The path is appended to the server, so it may never end up pointing at something else
        const publicUrl = validateHttpUrl(this.server + '/' + this.path, 'path');

        if (publicUrl.origin !== server.origin) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'The path of a file cannot change its server: ' + this.path,
                field: 'path',
            });
        }

        if (this.signedUrl) {
            validateHttpUrl(this.signedUrl, 'signedUrl');
        }
    }

    encode(context: EncodeContext) {
        this.validateUrls();

        return {
            id: this.id,
            server: this.server,
            path: this.path,
            size: this.size,
            name: this.name,
            isPrivate: this.isPrivate,
            signedUrl: this.isPrivate && this.signedUrl ? this.signedUrl : undefined,
            signature: this.isPrivate ? this.signature : undefined,
            contentType: this.contentType || undefined,
        };
    }

    getPublicPath(): string {
        if (this.signedUrl && this.isPrivate) {
            return this.signedUrl;
        }
        return this.server + '/' + this.path;
    }

    /**
     * Src to render this file inline in an email html body (e.g. `<img src="...">`), used in the html of a
     * `Replacement` that includes this file in its `files`: the email builder attaches the file with this
     * content id so email clients render it inline.
     */
    get inlineEmailSrc(): string {
        return 'cid:' + this.id;
    }

    /**
     * See {@link FileTypes.resolveUpload}: determines the content type and extension we'll store an uploaded
     * file with, or null if we don't support the file type.
     */
    static resolveUploadType(upload: { contentType?: string | null; filename?: string | null }): ResolvedFileType | null {
        return supportedFileTypes.resolveUpload(upload);
    }

    static removeExtension(filename: string): string {
        if (getFilenameExtension(filename) === null) {
            return filename;
        }
        return filename.split('.').slice(0, -1).join('.');
    }

    get icon() {
        if (!this.contentType) {
            // Try based on extension
            const extension = this.path.split('.').pop()?.toLowerCase() || this.name?.split('.').pop()?.toLowerCase();
            if (extension) {
                switch (extension) {
                    case 'png':
                    case 'jpg':
                    case 'jpeg':
                    case 'gif':
                    case 'webp':
                    case 'svg':
                        return 'file-image';
                    case 'pdf':
                        return 'file-pdf color-pdf';
                    case 'xlsx':
                    case 'xls':
                        return 'file-excel color-excel';
                    case 'docx':
                    case 'doc':
                        return 'file-word color-word';
                }
            }

            return 'file';
        }

        if (this.contentType.startsWith('image/')) {
            return 'file-image';
        }

        if (this.contentType === 'application/pdf') {
            return 'file-pdf color-pdf';
        }
        if (this.contentType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || this.contentType === 'application/vnd.ms-excel') {
            return 'file-excel color-excel';
        }
        if (this.contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || this.contentType === 'application/msword') {
            return 'file-word color-word';
        }

        return 'file';
    }
}
