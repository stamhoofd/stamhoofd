import type { Decoder } from '@simonbackx/simple-encoding';
import { AutoEncoder, BooleanDecoder, field, ObjectData } from '@simonbackx/simple-encoding';
import type { DecodedRequest, Request } from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import type { Organization } from '@stamhoofd/models';
import { Image, RateLimiter } from '@stamhoofd/models';
import { Image as ImageStruct, ResolutionRequest, supportedImageTypes } from '@stamhoofd/structures';
import formidable from 'formidable';
import { promises as fs } from 'fs';

import { Context } from '../../../helpers/Context.js';

type Params = Record<string, never>;
class Query extends AutoEncoder {
    @field({ decoder: BooleanDecoder, optional: true, field: 'private' })
    isPrivate: boolean = false;
}
type Body = undefined;
type ResponseBody = ImageStruct;

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

export const limiter = new RateLimiter({
    limits: [
        {
            // Max 50 per hour
            limit: 50,
            duration: 60 * 1000 * 60,
        },
    ],
});
export const organizationLimiter = new RateLimiter({
    limits: [
        {
            // Max 200 per day
            limit: 200,
            duration: 60 * 1000 * 60 * 24,
        },
    ],
});

export class UploadImage extends Endpoint<Params, Query, Body, ResponseBody> {
    queryDecoder = Query as Decoder<Query>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'POST') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/upload-image', {});

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

        const form = formidable({
            maxFileSize: 5 * 1024 * 1024,
            keepExtensions: true,
            maxFiles: 1,
        });

        const [file, resolutions] = await new Promise<[FormidableFile, ResolutionRequest[]]>((resolve, reject) => {
            if (!request.request.request) {
                reject(new SimpleError({
                    code: 'invalid_request',
                    message: 'Invalid request',
                    statusCode: 500,
                }));
                return;
            }

            form.parse(request.request.request, (err, fields, files) => {
                if (err) {
                    reject(err);
                    return;
                }
                if (!fields.resolutions || !Array.isArray(fields.resolutions) || fields.resolutions.length !== 1) {
                    reject(new SimpleError({
                        code: 'missing_field',
                        message: 'Field resolutions is required',
                        field: 'resolutions',
                    }));
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

                try {
                    const resolutions = new ObjectData(JSON.parse(fields.resolutions[0]), { version: request.request.getVersion() }).array(ResolutionRequest as Decoder<ResolutionRequest>);
                    resolve([files.file[0], resolutions]);
                } catch (e) {
                    reject(e);
                }
            });
        });

        try {
            // Never trust the content type of the uploader: it decides how we store the image, so only accept
            // the image types we know we can generate our resolutions from.
            const imageType = supportedImageTypes.resolveUpload({ contentType: file.mimetype, filename: file.originalFilename });

            if (!imageType) {
                throw new SimpleError({
                    code: 'invalid_file_type',
                    message: 'Unsupported image type ' + (file.mimetype ?? 'unknown') + ' for file ' + (file.originalFilename ?? 'unknown'),
                    human: $t('%ZhP'),
                    field: 'file',
                    statusCode: 400,
                });
            }

            const fileContent = await fs.readFile(file.filepath);
            const image = await Image.create(fileContent, imageType.contentType, resolutions, request.query.isPrivate, user, organization as Organization | null | undefined);
            return new Response(ImageStruct.create(image));
        } finally {
            // Formidable wrote the upload to a temporary file
            await fs.rm(file.filepath, { force: true }).catch(() => { /* we can't do anything about this */ });
        }
    }
}
