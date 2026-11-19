import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { SimpleError } from '@common/errors';
import { Image } from '@stamhoofd/models';
import { v4 as uuidv4 } from 'uuid';

const CONTENT_TYPE = 'application/pdf';

/**
 * The stored extract of a delivered judicial record.
 *
 * Objects are written with a private ACL and are only ever read back by the backend, which hands the bytes to a
 * reviewer over the authenticated api. No signed url is handed out, unlike everywhere else we store a file: a
 * signed url is a bearer token for someone's judicial record extract, it outlives the session in history, logs
 * and referrers, and nothing in our authorisation can take it back for the hour it is valid.
 */
export class JudicialRecordFileStore {
    /** The object key, to be kept on the record. */
    static async store(recordId: string, data: Uint8Array): Promise<string> {
        this.assertConfigured();

        const key = this.prefix() + 'judicial-records/' + recordId + '/' + uuidv4() + '.pdf';

        await Image.getS3Client().send(new PutObjectCommand({
            Bucket: STAMHOOFD.SPACES_BUCKET,
            Key: key,
            Body: data,
            ContentType: CONTENT_TYPE,
            ContentDisposition: 'attachment',
            ACL: 'private',
        }));

        return key;
    }

    static async read(key: string): Promise<Uint8Array> {
        this.assertConfigured();

        const response = await Image.getS3Client().send(new GetObjectCommand({
            Bucket: STAMHOOFD.SPACES_BUCKET,
            Key: key,
        }));

        if (!response.Body) {
            throw new SimpleError({
                code: 'judicial_record_document_not_available',
                message: 'The stored judicial record extract is empty',
                human: $t('We konden dit uittreksel niet openen.'),
                statusCode: 500,
            });
        }

        return await response.Body.transformToByteArray();
    }

    /**
     * Removing the object is what actually gets rid of the document; the record only records that it happened.
     * So this throws rather than reporting, and the caller marks the record as removed only once it returns.
     */
    static async remove(key: string): Promise<void> {
        this.assertConfigured();

        await Image.getS3Client().send(new DeleteObjectCommand({
            Bucket: STAMHOOFD.SPACES_BUCKET,
            Key: key,
        }));
    }

    /** Keeps every environment that shares a bucket out of each other's objects, as Image and UploadFile do. */
    private static prefix(): string {
        const parts: (string | undefined | null)[] = [STAMHOOFD.SPACES_PREFIX, STAMHOOFD.environment !== 'production' ? STAMHOOFD.environment : null];

        return parts.flatMap(part => part ? [part + '/'] : []).join('');
    }

    private static assertConfigured(): void {
        if (!STAMHOOFD.SPACES_BUCKET || !STAMHOOFD.SPACES_ENDPOINT || !STAMHOOFD.SPACES_KEY || !STAMHOOFD.SPACES_SECRET) {
            throw new SimpleError({
                code: 'not_available',
                message: 'File storage is not configured',
                statusCode: 503,
            });
        }
    }
}
