import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { File } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import AWS from 'aws-sdk';
import formidable from 'formidable';
import { promises as fs } from 'fs';
import { v4 as uuidv4 } from 'uuid';

import { Context } from '../../../helpers/Context';
import { limiter } from './UploadImage';
import { AutoEncoder, BooleanDecoder, Decoder, field } from '@simonbackx/simple-encoding';

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
            form.parse(request.request.request, (err, fields, files) => {
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
        });

        if (!STAMHOOFD.SPACES_BUCKET || !STAMHOOFD.SPACES_ENDPOINT || !STAMHOOFD.SPACES_KEY || !STAMHOOFD.SPACES_SECRET) {
            throw new SimpleError({
                code: 'not_available',
                message: 'Uploading is not available',
                statusCode: 503,
            });
        }

        const fileContent = await fs.readFile(file.filepath);

        const s3 = new AWS.S3({
            endpoint: STAMHOOFD.SPACES_ENDPOINT,
            accessKeyId: STAMHOOFD.SPACES_KEY,
            secretAccessKey: STAMHOOFD.SPACES_SECRET,
        });

        let prefix = (STAMHOOFD.SPACES_PREFIX ?? '');
        if (prefix.length > 0) {
            prefix += '/';
        }

        prefix += (STAMHOOFD.environment ?? 'development') === 'development' ? ('development/') : ('');

        // Prepend user id to the file path
        if (request.query.isPrivate && user) {
            // Private files
            prefix += 'users/' + user.id + '/';
        }
        else {
            // Public files
            prefix += 'p/';
        }

        // Also include the source, in private mode
        const fileId = uuidv4();
        let uploadExt = '';

        switch (file.mimetype?.toLocaleLowerCase()) {
            case 'image/jpeg':
            case 'image/jpg':
                uploadExt = 'jpg';
                break;
            case 'image/png':
                uploadExt = 'png';
                break;
            case 'image/gif':
                uploadExt = 'gif';
                break;
            case 'image/webp':
                uploadExt = 'webp';
                break;
            case 'image/svg+xml':
                uploadExt = 'svg';
                break;
            case 'application/pdf':
                uploadExt = 'pdf';
                break;
            case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
            case 'application/vnd.ms-excel':
                uploadExt = 'xlsx';
                break;

            case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
            case 'application/msword':
                uploadExt = 'docx';
                break;
        }

        const filenameWithoutExt = file.originalFilename?.split('.').slice(0, -1).join('.') ?? fileId;
        const key = prefix + fileId + '/' + (Formatter.slug(filenameWithoutExt) + (uploadExt ? ('.' + uploadExt) : ''));
        const params = {
            Bucket: STAMHOOFD.SPACES_BUCKET,
            Key: key,
            Body: fileContent, // TODO
            ContentType: file.mimetype ?? 'application/pdf',
            ACL: request.query.isPrivate ? 'private' : 'public-read',
        };

        const fileStruct = new File({
            id: fileId,
            server: 'https://' + STAMHOOFD.SPACES_BUCKET + '.' + STAMHOOFD.SPACES_ENDPOINT,
            path: key,
            size: fileContent.length,
            name: file.originalFilename,
            isPrivate: request.query.isPrivate,
        });

        // Generate an upload signature for this file if it is private
        if (request.query.isPrivate) {
            if (!await fileStruct.sign()) {
                throw new SimpleError({
                    code: 'failed_to_sign',
                    message: 'Failed to sign file',
                    human: $t('509cdb4f-131a-42a6-b3b1-a63cca231e65'),
                    statusCode: 500,
                });
            }
        }

        await s3.putObject(params).promise();

        return new Response(fileStruct);
    }
}
