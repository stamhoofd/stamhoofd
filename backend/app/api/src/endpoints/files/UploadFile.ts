
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { Token } from '@stamhoofd/models';
import { File } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import AWS from 'aws-sdk';
import formidable from 'formidable';
import { promises as fs } from "fs";
import { v4 as uuidv4 } from "uuid";

type Params = Record<string, never>;
type Query = {};
type Body = undefined
type ResponseBody = File


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
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "POST") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/upload-file", {});

        if (params) {
            return [true, params as Params];
        }

        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const token = await Token.authenticate(request);
        const user = token.user

        if (!user.hasReadAccess()) {
            throw new SimpleError({
                code: "permission_denied",
                message: "You do not have permissions for this endpoint",
                statusCode: 403
            })
        }


        if (!STAMHOOFD.SPACES_BUCKET || !STAMHOOFD.SPACES_ENDPOINT || !STAMHOOFD.SPACES_KEY || !STAMHOOFD.SPACES_SECRET) {
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


        if (!STAMHOOFD.SPACES_BUCKET || !STAMHOOFD.SPACES_ENDPOINT || !STAMHOOFD.SPACES_KEY || !STAMHOOFD.SPACES_SECRET) {
            throw new SimpleError({
                code: "not_available",
                message: "Uploading is not available",
                statusCode: 503
            })
        }

        const fileContent = await fs.readFile(file.filepath);

        const s3 = new AWS.S3({
            endpoint: STAMHOOFD.SPACES_ENDPOINT,
            accessKeyId: STAMHOOFD.SPACES_KEY,
            secretAccessKey: STAMHOOFD.SPACES_SECRET
        });

        let prefix = (STAMHOOFD.SPACES_PREFIX ?? "")
        if (prefix.length > 0) {
            prefix += "/"
        }
        
        // Also include the source, in private mode
        const fileId = uuidv4();
        const uploadExt = file.mimetype == "application/pdf" ? "pdf" : "pdf"
        const filenameWithoutExt = file.originalFilename?.split(".").slice(0, -1).join(".") ?? fileId
        const key = prefix+(STAMHOOFD.environment ?? "development")+"/"+fileId+"/" + (Formatter.slug(filenameWithoutExt) +"."+uploadExt);
        const params = {
            Bucket: STAMHOOFD.SPACES_BUCKET,
            Key: key,
            Body: fileContent, // TODO
            ContentType: file.mimetype ?? "application/pdf",
            ACL: "public-read"
        };

        const fileStruct = new File({
            id: fileId,
            server: "https://"+STAMHOOFD.SPACES_BUCKET+"."+STAMHOOFD.SPACES_ENDPOINT,
            path: key,
            size: fileContent.length,
            name: file.originalFilename
        });

        await s3.putObject(params).promise();

        return new Response(fileStruct);
    }
}
