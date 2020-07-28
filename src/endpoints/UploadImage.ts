
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints'
import { SimpleError } from '@simonbackx/simple-errors'
import { Image as ImageStruct } from '@stamhoofd/structures';
import formidable from 'formidable';
import { promises as fs } from "fs";

type Params = {};
type Query = {};
type Body = undefined
type ResponseBody = ImageStruct

import { Token } from '../models/Token';

interface FormidableFile {
  // The size of the uploaded file in bytes.
  // If the file is still being uploaded (see `'fileBegin'` event),
  // this property says how many bytes of the file have been written to disk yet.
  size: number;

  // The path this file is being written to. You can modify this in the `'fileBegin'` event in
  // case you are unhappy with the way formidable generates a temporary path for your files.
  path: string;

  // The name this file had according to the uploading client.
  name: string | null;

  // The mime type of this file, according to the uploading client.
  type: string | null;

  // A Date object (or `null`) containing the time this file was last written to.
  // Mostly here for compatibility with the [W3C File API Draft](http://dev.w3.org/2006/webapi/FileAPI/).
  lastModifiedDate: Date | null;

  // If `options.hash` calculation was set, you can read the hex digest out of this var.
  hash: string | 'sha1' | 'md5' | 'sha256' | null;
}

export class UploadImage extends Endpoint<Params, Query, Body, ResponseBody> {    
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "POST") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/backoffice/upload-image", {});

        if (params) {
            return [true, params as Params];
        }

        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const token = await Token.authenticate(request);
        const user = token.user

        if (!user.permissions || !user.permissions.hasReadAccess()) {
            throw new SimpleError({
                code: "permission_denied",
                message: "You do not have permissions for this endpoint",
                statusCode: 403
            })
        }


        if (!process.env.SPACES_BUCKET || !process.env.SPACES_ENDPOINT || !process.env.SPACES_KEY || !process.env.SPACES_SECRET) {
            throw new SimpleError({
                code: "not_available",
                message: "This endpoint is temporarily not available",
                statusCode: 503
            })
        }

        if (!request.request.request) {
            throw new Error("Not supported without real request")
        }

        const form = formidable({ maxFileSize: 20 * 1024 * 1024, maxFields: 1, keepExtensions: true });
        const file = await new Promise<FormidableFile>((resolve, reject) => {
            form.parse(request.request.request, (err, fields, file: {file: FormidableFile}) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(file.file);
            });
        });

        const fileContent = await fs.readFile(file.path);
        //const image = await Image.create(fileContent, file.type ?? undefined)
        return new Response(ImageStruct.create({}));
    }
}
