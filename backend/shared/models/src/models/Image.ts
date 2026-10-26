import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'; // ES Modules import
import { column } from '@simonbackx/simple-database';
import { ArrayDecoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { QueryableModel } from '@stamhoofd/sql';
import type { ResolutionRequest } from '@stamhoofd/structures';
import { File, Resolution, ResolutionFit, supportedImageTypes } from '@stamhoofd/structures';
import type { OutputInfo } from 'sharp';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import type { Organization } from './Organization.js';

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

    /**
     * Processing budgets per image upload: at most eight variants, each axis at
     * most 8192 pixels, a 40-megapixel decoded input, a 16-megapixel output per
     * variant and 32 megapixels across all variants. Output estimates use the
     * requested sizes even when raster enlargement will be disabled.
     * These allow the UI's seven cover variants and 2480 x 3508 invoice background.
     */
    static readonly maxResolutions = 8;
    static readonly maxDimension = 8192;
    static readonly maxInputPixels = 40_000_000;
    static readonly maxOutputPixels = 16_000_000;
    static readonly maxTotalOutputPixels = 32_000_000;

    /**
     * Validates decoded variant requests without opening the image. An empty list
     * is allowed; each supplied variant needs a recognized fit and at least one
     * positive integer dimension within the axis budget. Throws a field-specific
     * 400 invalid_resolutions error on failure. Aspect-ratio-derived sizes and
     * pixel totals are checked by create once source metadata is available.
     */
    static validateResolutions(resolutions: ResolutionRequest[]) {
        // Share the same client-facing error for count, fit and dimension failures.
        const invalid = () => new SimpleError({ code: 'invalid_resolutions', message: 'Image resolutions exceed the processing limits', field: 'resolutions', statusCode: 400 });
        if (resolutions.length > this.maxResolutions) {
            throw invalid();
        }
        for (const r of resolutions) {
            if ((r.width == null && r.height == null) || !Object.values(ResolutionFit).includes(r.fit)) {
                throw invalid();
            }
            for (const dimension of [r.width, r.height]) {
                if (dimension != null && (!Number.isInteger(dimension) || dimension < 1 || dimension > this.maxDimension)) {
                    throw invalid();
                }
            }
        }
    }

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

    /**
     * Renders requested variants from image bytes or an input path, uploads them
     * with the original source and returns the saved model. The supplied type
     * selects output encoding; Sharp detects the input format itself.
     *
     * For nonempty variant lists, input metadata and all estimated output budgets
     * are validated before rendering or storage. Variants render sequentially on
     * independent clones to bound concurrent processing. An empty list stores
     * only the private attachment source and does not decode image pixels.
     */
    static async create(fileContent: string | Buffer, type: string | undefined, resolutions: ResolutionRequest[], isPrivateFile: boolean = false, user: { id: string } | null = null, organization: Organization | null = null): Promise<Image> {
        this.validateResolutions(resolutions);
        if (!STAMHOOFD.SPACES_BUCKET || !STAMHOOFD.SPACES_ENDPOINT || !STAMHOOFD.SPACES_KEY || !STAMHOOFD.SPACES_SECRET) {
            throw new SimpleError({
                code: 'not_available',
                message: 'Uploading is not available',
                statusCode: 503,
            });
        }

        // Fall back to png for content types we don't recognize: sharp detects the real format itself, so
        // this only decides how we store the file
        const imageType = (type ? supportedImageTypes.resolveUpload({ contentType: type }) : null) ?? { contentType: 'image/png', extension: 'png' };
        const fileType = imageType.extension;

        console.log('creating image', fileType, type, resolutions);

        const supportsTransparency = fileType !== 'jpg';
        const files: { data: Buffer; info: OutputInfo }[] = [];

        if (resolutions.length) {
            // Apply the input budget to the detected format, including SVGs with a misleading extension.
            // SVGs use natural 72 dpi dimensions for metadata and rasterization.
            let sharpStream = sharp(fileContent, { limitInputPixels: this.maxInputPixels, density: 72 }).rotate();
            const metadata = await sharpStream.metadata();
            // Match rotate()'s EXIF axis swap when estimating aspect-ratio-derived sizes.
            const swapped = metadata.orientation !== undefined && metadata.orientation >= 5;
            const width = (swapped ? metadata.height : metadata.width)!;
            const height = (swapped ? metadata.width : metadata.height)!;
            let totalPixels = 0;
            for (const r of resolutions) {
                const scales = [r.width == null ? null : r.width / width, r.height == null ? null : r.height / height].filter(s => s !== null);
                const scale = r.fit === ResolutionFit.Outside ? Math.max(...scales) : Math.min(...scales);
                // Cover/contain/fill have a bounded canvas; outside and one-sided requests retain the aspect ratio.
                const boundedCanvas = r.width != null && r.height != null && r.fit !== ResolutionFit.Outside;
                const outputWidth = boundedCanvas ? r.width! : Math.ceil(width * scale);
                const outputHeight = boundedCanvas ? r.height! : Math.ceil(height * scale);
                const pixels = outputWidth * outputHeight;
                totalPixels += pixels;
                if (!Number.isFinite(pixels) || outputWidth > this.maxDimension || outputHeight > this.maxDimension || pixels > this.maxOutputPixels || totalPixels > this.maxTotalOutputPixels) {
                    throw new SimpleError({ code: 'invalid_resolutions', message: 'Image resolutions exceed the processing limits', field: 'resolutions', statusCode: 400 });
                }
            }
            if (!supportsTransparency) {
                sharpStream = sharpStream.flatten({ background: { r: 255, g: 255, b: 255 } });
            }

            for (const r of resolutions) {
                const size = {
                    width: r.width ?? undefined,
                    height: r.height ?? undefined,
                    fit: r.fit,
                    withoutEnlargement: fileType !== 'svg',
                };

                let t = sharpStream.clone().resize(size);

                // Generate the image data
                if (!supportsTransparency) {
                    t = t.jpeg({
                        quality: 80,
                    });
                } else {
                    t = t.png();
                }

                files.push(await t.toBuffer({ resolveWithObject: true }));
            }
        }

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
        } else if (isPrivateFile && !user && organization) {
            prefix += 'anonymous/' + organization.id + '/';
        } else {
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
                contentType: !supportsTransparency ? 'image/jpeg' : 'image/png',
            });

            if (isPrivateFile) {
                if (!await _file.sign()) {
                    throw new SimpleError({
                        code: 'failed_to_sign',
                        message: 'Failed to sign file',
                        human: $t('%B6'),
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
            // Never store the content type reported by the uploader: this is the only file we store
            // unaltered, so it should never be rendered by a browser
            ContentType: imageType.contentType,
            ContentDisposition: 'attachment',
            ACL: 'private',
        });
        uploadPromises.push(client.send(cmd));

        await Promise.all(uploadPromises);
        await image.save();
        return image;
    }
}
