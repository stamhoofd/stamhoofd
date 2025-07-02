import { PutObjectCommand } from '@aws-sdk/client-s3';
import { Migration } from '@simonbackx/simple-database';
import { SimpleError } from '@simonbackx/simple-errors';
import { logger } from '@simonbackx/simple-logging';
import { Email, Image } from '@stamhoofd/models';
import { File } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { v4 as uuidv4 } from 'uuid';

/**
 * Replace all base64 email attachments with file attachments.
 */
export default new Migration(async () => {
    if (STAMHOOFD.environment == 'test') {
        console.log('skipped in tests');
        return;
    }

    process.stdout.write('\n');
    let c = 0;

    await logger.setContext({ tags: ['seed'] }, async () => {
        for await (const email of Email.select().limit(10).all()) {
            let save = false;
            for (const attachment of email.attachments) {
                if (attachment.content) {
                    try {
                        console.log('Uploading base64 attachment for email ' + email.id);
                        save = true;

                        let prefix = (STAMHOOFD.SPACES_PREFIX ?? '');
                        if (prefix.length > 0) {
                            prefix += '/';
                        }

                        prefix += (STAMHOOFD.environment ?? 'development') === 'development' ? ('development/') : ('');
                        // Prepend user id to the file path
                        // Private files
                        if (email.userId) {
                            prefix += 'users/' + email.userId + '/';
                        }
                        else {
                            // Public files
                            prefix += 'p/';
                        }

                        const fileContent = Buffer.from(attachment.content, 'base64');

                        const fileId = uuidv4();
                        const uploadExt = File.contentTypeToExtension(attachment.contentType ?? '') ?? '';
                        const filenameWithoutExt = File.removeExtension(attachment.filename);
                        const key = prefix + fileId + '/' + (Formatter.slug(filenameWithoutExt) + (uploadExt ? ('.' + uploadExt) : ''));

                        const fileStruct = new File({
                            id: fileId,
                            server: 'https://' + STAMHOOFD.SPACES_BUCKET + '.' + STAMHOOFD.SPACES_ENDPOINT,
                            path: key,
                            size: fileContent.length,
                            name: attachment.filename,
                            isPrivate: true,
                            contentType: attachment.contentType ?? null,
                        });

                        // Generate an upload signature for this file if it is private
                        if (!await fileStruct.sign()) {
                            throw new SimpleError({
                                code: 'failed_to_sign',
                                message: 'Failed to sign file',
                                statusCode: 500,
                            });
                        }

                        const cmd = new PutObjectCommand({
                            Bucket: STAMHOOFD.SPACES_BUCKET,
                            Key: key,
                            Body: fileContent,
                            ContentType: attachment.contentType ?? 'application/octet-stream',
                            ACL: 'private',
                        });
                        await Image.getS3Client().send(cmd);

                        console.log('Successfully uploaded base64 attachment for email ' + email.id + ' as file ' + fileStruct.id);

                        attachment.file = fileStruct;
                        attachment.content = null; // Clear the base64 content
                    }
                    catch (e) {
                        console.error('Failed to upload base64 attachment for email ' + email.id, e);
                        continue; // Skip this email if it fails
                    }
                }
            }

            if (save) {
                await email.save();
                c++;
                process.stdout.write('.');
            }
        }
    });

    console.log('\nUpdated attachments for ' + c + ' emails');

    // Do something here
    return Promise.resolve();
});
