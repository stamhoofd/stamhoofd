
import { column, Model } from "@simonbackx/simple-database";
import { ArrayDecoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { File, Resolution, ResolutionRequest } from '@stamhoofd/structures';
import AWS from 'aws-sdk';
import sharp from "sharp";
import { v4 as uuidv4 } from "uuid";

export class Image extends Model {
    static table = "images";

    @column({ primary: true, type: "string", beforeSave(value) {
        return value ?? uuidv4();
    } })
    id!: string;

    @column({ type: "json", decoder: File })
    source: File

    @column({ type: "json", decoder: new ArrayDecoder(Resolution) })
    resolutions: Resolution[] = []

    @column({ type: "datetime" })
    createdAt: Date = new Date()

    static async create(fileContent: string | Buffer, type: string | undefined, resolutions: ResolutionRequest[]): Promise<Image> {
        if (!STAMHOOFD.SPACES_BUCKET || !STAMHOOFD.SPACES_ENDPOINT || !STAMHOOFD.SPACES_KEY || !STAMHOOFD.SPACES_SECRET) {
            throw new SimpleError({
                code: "not_available",
                message: "Uploading is not available",
                statusCode: 503
            })
        }

        let fileType = 'png';
        if (type == "image/jpeg" || type == "image/jpg") {
            fileType = "jpg";
        }
        if (type === "image/svg+xml" || type === "image/svg") {
            fileType = "svg";
        }

        console.log('creating image', fileType, type, resolutions)

        const supportsTransparency = fileType == "png" || fileType == "svg"
        const promises: Promise<{data: Buffer;info: sharp.OutputInfo}>[] = [];

        if (resolutions.length) {
            let sharpStream = sharp(fileContent, fileType === 'svg' ? {density: 600} : {}).rotate(); 
            if (!supportsTransparency) {
                sharpStream = sharpStream.flatten({background: {r: 255, g: 255, b: 255}});
            }

            for(const r of resolutions) {
                const size = {
                    width: r.width ?? undefined,
                    height: r.height ?? undefined,
                    fit: r.fit,
                    withoutEnlargement: type !== "image/svg+xml"
                }

                let t = sharpStream.resize(size);

                // Generate the image data
                if (!supportsTransparency) {
                    t = t.jpeg({
                            quality: 80,
                        });
                } else {
                    t = t.png();
                }

                promises.push(t.toBuffer({ resolveWithObject: true }));
            }
        }

        const files = await Promise.all(promises);

        const s3 = new AWS.S3({
            endpoint: STAMHOOFD.SPACES_ENDPOINT,
            accessKeyId: STAMHOOFD.SPACES_KEY,
            secretAccessKey: STAMHOOFD.SPACES_SECRET
        });

        let prefix = (STAMHOOFD.SPACES_PREFIX ?? "")
        if (prefix.length > 0) {
            prefix += "/"
        }

        const uploadPromises: Promise<any>[] = []
        const image = new Image()
        image.id = uuidv4();

        for (const f of files) {
            const fileId = uuidv4();

            const key = prefix+(STAMHOOFD.environment ?? "development")+"/"+image.id+"/"+fileId+(!supportsTransparency ? '.jpg' : '.png');
            const params = {
                Bucket: STAMHOOFD.SPACES_BUCKET,
                Key: key,
                Body: f.data,
                ContentType: !supportsTransparency ? 'image/jpeg' : 'image/png',
                ACL: "public-read"
            };

            uploadPromises.push(s3.putObject(params).promise());

            const _file = new File({
                id: fileId,
                server: "https://"+STAMHOOFD.SPACES_BUCKET+"."+STAMHOOFD.SPACES_ENDPOINT,
                path: key,
                size: f.info.size
            });

            const _image = new Resolution({
                file: _file,
                width: f.info.width,
                height: f.info.height,
            });
            image.resolutions.push(_image)
        }

        // Also include the source, in private mode
        const fileId = uuidv4();
        const uploadExt = fileType
        const key = prefix+(STAMHOOFD.environment ?? "development")+"/"+image.id+"/"+fileId+"."+uploadExt;
        const params = {
            Bucket: STAMHOOFD.SPACES_BUCKET,
            Key: key,
            Body: fileContent,
            ContentType: type ?? "image/jpeg",
            ACL: "private"
        };

        image.source = new File({
            id: fileId,
            server: "https://"+STAMHOOFD.SPACES_BUCKET+"."+STAMHOOFD.SPACES_ENDPOINT,
            path: key,
            size: fileContent.length
        });

        uploadPromises.push(s3.putObject(params).promise());

        await Promise.all(uploadPromises);
        await image.save();
        return image
    }
}
