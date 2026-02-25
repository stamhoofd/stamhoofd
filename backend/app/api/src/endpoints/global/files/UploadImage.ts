import { AutoEncoder, BooleanDecoder, Decoder, field, ObjectData } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { Image, RateLimiter } from '@stamhoofd/models';
import { Image as ImageStruct, ResolutionRequest } from '@stamhoofd/structures';
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
        await Context.setOptionalOrganizationScope();
        const { user } = await Context.authenticate();

        if (!Context.auth.canUpload({ private: request.query.isPrivate })) {
            throw Context.auth.error();
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

        limiter.track(user.id, 1);

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
                }
                catch (e) {
                    reject(e);
                }
            });
        });

        const fileContent = await fs.readFile(file.filepath);
        const image = await Image.create(fileContent, file.mimetype ?? undefined, resolutions, request.query.isPrivate, user);
        return new Response(ImageStruct.create(image));
    }
}
