import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'; // ES Modules import
import { column } from '@simonbackx/simple-database';
import { ArrayDecoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { QueryableModel } from '@stamhoofd/sql';
import { File, Resolution, ResolutionRequest } from '@stamhoofd/structures';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';

export class Image extends QueryableModel {
    static table = 'images';

    @column({ primary: true, type: 'string', beforeSave(value) {
        return value ?? uuidv4();
    } })
    id!: string;

    @column({ type: 'json', decoder: File })
    source: File;

    @column({ type: 'json', decoder: new ArrayDecoder(Resolution) })
    resolutions: Resolution[] = [];

    @column({ type: 'datetime' })
    createdAt: Date = new Date();

    static s3Client: S3Client | null = null;

    static getS3Client(): S3Client {
        if (!this.s3Client) {
            this.s3Client = new S3Client({
                forcePathStyle: false, // Configures to use subdomain/virtual calling format.
                endpoint: 'https://' + STAMHOOFD.SPACES_ENDPOINT,
                credentials: {
                    accessKeyId: STAMHOOFD.SPACES_KEY,
                    secretAccessKey: STAMHOOFD.SPACES_SECRET,
                },
                region: 'eu-west-1', // Not used, but required by the S3Client
            });
        }
        return this.s3Client;
    }

    static async create(fileContent: string | Buffer, type: string | undefined, resolutions: ResolutionRequest[], isPrivateFile: boolean = false, user: { id: string } | null = null): Promise<Image> {
        if (!STAMHOOFD.SPACES_BUCKET || !STAMHOOFD.SPACES_ENDPOINT || !STAMHOOFD.SPACES_KEY || !STAMHOOFD.SPACES_SECRET) {
            throw new SimpleError({
                code: 'not_available',
                message: 'Uploading is not available',
                statusCode: 503,
            });
        }

        let fileType = 'png';
        if (type == 'image/jpeg' || type == 'image/jpg') {
            fileType = 'jpg';
        }
        if (type == 'image/webp') {
            fileType = 'webp';
        }
        if (type === 'image/svg+xml' || type === 'image/svg') {
            fileType = 'svg';
        }

        console.log('creating image', fileType, type, resolutions);

        const supportsTransparency = fileType == 'png' || fileType == 'svg' || fileType == 'webp';
        const promises: Promise<{ data: Buffer;info: sharp.OutputInfo }>[] = [];

        if (resolutions.length) {
            let sharpStream = sharp(fileContent, fileType === 'svg' ? { density: 600 } : {}).rotate();
            if (!supportsTransparency) {
                sharpStream = sharpStream.flatten({ background: { r: 255, g: 255, b: 255 } });
            }

            for (const r of resolutions) {
                const size = {
                    width: r.width ?? undefined,
                    height: r.height ?? undefined,
                    fit: r.fit,
                    withoutEnlargement: type !== 'image/svg+xml',
                };

                let t = sharpStream.resize(size);

                // Generate the image data
                if (!supportsTransparency) {
                    t = t.jpeg({
                        quality: 80,
                    });
                }
                else {
                    t = t.png();
                }

                promises.push(t.toBuffer({ resolveWithObject: true }));
            }
        }

        const files = await Promise.all(promises);

        const client = this.getS3Client();

        let prefix = (STAMHOOFD.SPACES_PREFIX ?? '');
        if (prefix.length > 0) {
            prefix += '/';
        }

        prefix += (STAMHOOFD.environment ?? 'development') === 'development' ? ('development/') : ('');

        // Prepend user id to the file path
        if (isPrivateFile && user) {
            // Private files
            prefix += 'users/' + user.id + '/';
        }
        else {
            // Public files
            prefix += 'p/';
        }

        const uploadPromises: Promise<any>[] = [];
        const image = new Image();
        image.id = uuidv4();

        for (const f of files) {
            const fileId = uuidv4();

            const key = prefix + image.id + '/' + fileId + (!supportsTransparency ? '.jpg' : '.png');
            const cmd = new PutObjectCommand({
                Bucket: STAMHOOFD.SPACES_BUCKET,
                Key: key,
                Body: f.data,
                ContentType: !supportsTransparency ? 'image/jpeg' : 'image/png',
                ACL: isPrivateFile ? 'private' : 'public-read',
            });

            uploadPromises.push(
                client.send(cmd),
            );

            const _file = new File({
                id: fileId,
                server: 'https://' + STAMHOOFD.SPACES_BUCKET + '.' + STAMHOOFD.SPACES_ENDPOINT,
                path: key,
                size: f.info.size,
                isPrivate: isPrivateFile,
            });

            if (isPrivateFile) {
                if (!await _file.sign()) {
                    throw new SimpleError({
                        code: 'failed_to_sign',
                        message: 'Failed to sign file',
                        human: $t('509cdb4f-131a-42a6-b3b1-a63cca231e65'),
                        statusCode: 500,
                    });
                }
            }

            const _image = new Resolution({
                file: _file,
                width: f.info.width,
                height: f.info.height,
            });
            image.resolutions.push(_image);
        }

        // Also include the source, in private mode
        const fileId = uuidv4();
        const uploadExt = fileType;
        const key = prefix + (STAMHOOFD.environment ?? 'development') + '/' + image.id + '/' + fileId + '.' + uploadExt;
        image.source = new File({
            id: fileId,
            server: 'https://' + STAMHOOFD.SPACES_BUCKET + '.' + STAMHOOFD.SPACES_ENDPOINT,
            path: key,
            size: fileContent.length,
            // Don't set private here, as we don't allow to download this file
        });

        const cmd = new PutObjectCommand({
            Bucket: STAMHOOFD.SPACES_BUCKET,
            Key: key,
            Body: fileContent,
            ContentType: type ?? 'image/jpeg',
            ACL: 'private',
        });
        uploadPromises.push(client.send(cmd));

        await Promise.all(uploadPromises);
        await image.save();
        return image;
    }
}
