import { PutObjectCommand } from '@aws-sdk/client-s3'; // ES Modules import
import type { DecodedRequest, Request } from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { File } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import formidable from 'formidable';
import { promises as fs } from 'fs';
import { v4 as uuidv4 } from 'uuid';

import type { Decoder } from '@simonbackx/simple-encoding';
import { AutoEncoder, BooleanDecoder, field } from '@simonbackx/simple-encoding';
import { Context } from '../../../helpers/Context.js';
import { limiter, organizationLimiter } from './UploadImage.js';
import type { Organization } from '@stamhoofd/models';
import { Image } from '@stamhoofd/models';

type Params = Record<string, never>;
class Query extends AutoEncoder {
    @field({ decoder: BooleanDecoder, optional: true, field: 'private' })
    isPrivate: boolean = false;
}

type Body = undefined;
type ResponseBody = File;

interface FormidableFile {
    // The size of the uploaded file in bytes.
    // If the file is still being uploaded (see `'fileBegin'` event),
    // this property says how many bytes of the file have been written to disk yet.
    size: number;

    // The path this file is being written to. You can modify this in the `'fileBegin'` event in
    // case you are unhappy with the way formidable generates a temporary path for your files.
    filepath: string;

    // The name this file had according to the uploading client.
    originalFilename: string | null;

    // The mime type of this file, according to the uploading client.
    mimetype: string | null;
}

export class UploadFile extends Endpoint<Params, Query, Body, ResponseBody> {
    queryDecoder = Query as Decoder<Query>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'POST') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/upload-file', {});

        if (params) {
            return [true, params as Params];
        }

        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOptionalOrganizationScope();
        const { user } = await Context.optionalAuthenticate();

        // Webshops allow for file upload, but don't have a user attached
        if (user) {
            if (!Context.auth?.canUpload({ private: request.query.isPrivate })) {
                throw Context.auth.error();
            }
        } else if (!organization) {
            throw new SimpleError({
                code: 'permission_denied',
                message: 'Endpoints needs organization if no user is present',
                human: $t('Er ging iets mis. Probeer het opnieuw'),
            });
        }

        if (!STAMHOOFD.SPACES_BUCKET || !STAMHOOFD.SPACES_ENDPOINT || !STAMHOOFD.SPACES_KEY || !STAMHOOFD.SPACES_SECRET) {
            throw new SimpleError({
                code: 'not_available',
                message: 'This endpoint is temporarily not available',
                statusCode: 503,
            });
        }

        if (!request.request.request) {
            throw new Error('Not supported without real request');
        }

        if (user) {
            limiter.track(user.id, 1);
        } else {
            limiter.track(request.request.getIP(), 1);
            if (organization) {
                organizationLimiter.track(organization.id, 1);
            }
        }

        const form = formidable({ maxFileSize: 20 * 1024 * 1024, maxFields: 1, keepExtensions: true });
        const file = await new Promise<FormidableFile>((resolve, reject) => {
            if (!request.request.request) {
                reject(new SimpleError({
                    code: 'invalid_request',
                    message: 'Invalid request',
                    statusCode: 500,
                }));
                return;
            }
            try {
                if (request.request.request?.destroyed) {
                    throw new Error('Request destroyed before parsing');
                }
                form.parse(request.request.request, (err, fields, files) => {
                    console.log('form.parse', err, fields, files);
                    if (err) {
                        reject(err);
                        return;
                    }

                    if (!files.file || !Array.isArray(files.file) || files.file.length !== 1) {
                        reject(new SimpleError({
                            code: 'missing_field',
                            message: 'Missing file',
                            field: 'file',
                        }));
                        return;
                    }

                    resolve(files.file[0]);
                });
            } catch (e) {
                console.error(e);
                reject(e);
            }
        });

        try {
            return await this.upload(request, file, organization, user);
        } finally {
            // Formidable wrote the upload to a temporary file
            await fs.rm(file.filepath, { force: true }).catch(() => { /* we can't do anything about this */ });
        }
    }

    private async upload(request: DecodedRequest<Params, Query, Body>, file: FormidableFile, organization: Organization | null, user?: { id: string }) {
        if (!STAMHOOFD.SPACES_BUCKET || !STAMHOOFD.SPACES_ENDPOINT || !STAMHOOFD.SPACES_KEY || !STAMHOOFD.SPACES_SECRET) {
            throw new SimpleError({
                code: 'not_available',
                message: 'Uploading is not available',
                statusCode: 503,
            });
        }

        // Never trust the content type of the uploader: it is served back to browsers when the file is
        // downloaded, so we only allow content types we know are safe to serve.
        const uploadType = File.resolveUploadType({ contentType: file.mimetype, filename: file.originalFilename });

        if (!uploadType) {
            throw new SimpleError({
                code: 'invalid_file_type',
                message: 'Unsupported file type ' + (file.mimetype ?? 'unknown') + ' for file ' + (file.originalFilename ?? 'unknown'),
                human: $t('%ZiD'),
                field: 'file',
                statusCode: 400,
            });
        }

        const fileContent = await fs.readFile(file.filepath);

        let prefix = (STAMHOOFD.SPACES_PREFIX ?? '');
        if (prefix.length > 0) {
            prefix += '/';
        }

        const envPrefix = STAMHOOFD.environment !== 'production' ? STAMHOOFD.environment : null;

        if (envPrefix && envPrefix !== (STAMHOOFD.SPACES_PREFIX ?? '')) {
            prefix += envPrefix + '/';
        }

        // Prepend user id to the file path
        if (request.query.isPrivate && user) {
            // Private files
            prefix += 'users/' + user.id + '/';
        } else if (request.query.isPrivate && !user && organization) {
            prefix += 'anonymous/' + organization.id + '/';
        } else {
            // Public files
            prefix += 'p/';
        }

        // Also include the source, in private mode
        const fileId = uuidv4();

        const filenameWithoutExt = file.originalFilename ? File.removeExtension(file.originalFilename) : '';
        const key = prefix + fileId + '/' + ((Formatter.slug(filenameWithoutExt) || fileId) + '.' + uploadType.extension);

        const fileStruct = new File({
            id: fileId,
            server: 'https://' + STAMHOOFD.SPACES_BUCKET + '.' + STAMHOOFD.SPACES_ENDPOINT,
            path: key,
            // Always keep the extension in sync with the content type we store the file with
            name: filenameWithoutExt ? filenameWithoutExt + '.' + uploadType.extension : null,
            size: fileContent.length,
            isPrivate: request.query.isPrivate,
            contentType: uploadType.contentType,
        });

        // Generate an upload signature for this file if it is private
        if (request.query.isPrivate) {
            if (!await fileStruct.sign()) {
                throw new SimpleError({
                    code: 'failed_to_sign',
                    message: 'Failed to sign file',
                    human: $t('%B6'),
                    statusCode: 500,
                });
            }
        }

        const cmd = new PutObjectCommand({
            Bucket: STAMHOOFD.SPACES_BUCKET,
            Key: key,
            Body: fileContent,
            ContentType: uploadType.contentType,
            // Only let the browser render file types it can't execute
            ContentDisposition: uploadType.canRenderInline ? 'inline' : 'attachment',
            ACL: request.query.isPrivate ? 'private' : 'public-read',
        });
        await Image.getS3Client().send(cmd);

        return new Response(fileStruct);
    }
}
