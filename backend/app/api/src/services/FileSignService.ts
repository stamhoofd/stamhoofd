import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'; // ES Modules import
import {
    getSignedUrl,
} from '@aws-sdk/s3-request-presigner';
import { DecodedRequest, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { File } from '@stamhoofd/structures';
import chalk from 'chalk';
import * as jose from 'jose';

/**
 * This service creates signed urls for valid files
 */
export class FileSignService {
    static s3: S3Client;

    static async load() {
        this.s3 = new S3Client({
            forcePathStyle: false, // Configures to use subdomain/virtual calling format.
            endpoint: 'https://' + STAMHOOFD.SPACES_ENDPOINT,
            credentials: {
                accessKeyId: STAMHOOFD.SPACES_KEY,
                secretAccessKey: STAMHOOFD.SPACES_SECRET,
            },
            region: 'eu-west-1', // Not used, but required by the S3Client
        });

        /**
         * Note the algorithm is only used for signing. For verification the algorithm inside the public keys are used
         */
        const alg = STAMHOOFD.FILE_SIGNING_ALG || 'ES256';

        if (!STAMHOOFD.FILE_SIGNING_PUBLIC_KEY || !STAMHOOFD.FILE_SIGNING_PRIVATE_KEY) {
            if (STAMHOOFD.environment !== 'development' && STAMHOOFD.environment !== 'test') {
                throw new Error('Missing environment variables for file signing. Please make sure FILE_SIGNING_PUBLIC_KEY, FILE_SIGNING_PRIVATE_KEY and FILE_SIGNING_ALG are set.');
            }

            console.warn(chalk.yellow('File signing is disabled because the environment variables are not set. Please make sure FILE_SIGNING_PUBLIC_KEY, FILE_SIGNING_PRIVATE_KEY and FILE_SIGNING_ALG are set.'));

            const { publicKey, privateKey } = await jose.generateKeyPair(alg);

            const exportedPublicKey = await jose.exportJWK(publicKey);
            const exportedPrivateKey = await jose.exportJWK(privateKey);

            console.log('Example keys you can use in your development environment:');
            console.log('FILE_SIGNING_PUBLIC_KEY:', JSON.stringify(exportedPublicKey));
            console.log('FILE_SIGNING_ALG:', JSON.stringify(exportedPrivateKey));

            return;
        }

        const privateKey = await jose.importJWK(STAMHOOFD.FILE_SIGNING_PRIVATE_KEY!);

        // Support for multiple public keys (in case we need to rotate keys)
        const jwks = jose.createLocalJWKSet({
            keys: [
                STAMHOOFD.FILE_SIGNING_PUBLIC_KEY!,
            ],
        });

        File.verifyFile = async (file) => {
            if (!file.signature) {
                return false;
            }

            try {
                const { payload, protectedHeader } = await jose.compactVerify(file.signature, jwks);

                // Check if payload matches the file
                const decoded = (new TextDecoder().decode(payload));
                if (decoded !== file.signPayload) {
                    console.error('Invalid payload:', decoded);
                    return false;
                }

                return true;
            }
            catch (e) {
                if (e instanceof jose.errors.JWSSignatureVerificationFailed) {
                    return false;
                }
                if (STAMHOOFD.environment !== 'test') {
                    console.error('Failed to verify file signature:', e);
                }
                return false;
            }
        };

        File.signFile = async (file) => {
            if (!STAMHOOFD.FILE_SIGNING_PRIVATE_KEY) {
                return;
            }
            const jws = await new jose.CompactSign(
                new TextEncoder().encode(file.signPayload),
            )
                .setProtectedHeader({ alg })
                .sign(privateKey);

            file.signature = jws;
        };

        File.getWithSignedUrl = async (file: File) => {
            return this.withSignedUrl(file);
        };
    }

    static async withSignedUrl(file: File, duration = 60 * 60) {
        if (file.signedUrl) {
            console.error('Warning: file already signed');
        }

        try {
            const command = new GetObjectCommand({
                Bucket: STAMHOOFD.SPACES_BUCKET,
                Key: file.path,
            });
            const url = await getSignedUrl(this.s3, command, { expiresIn: duration });

            return new File({
                ...file,
                signedUrl: url,
            });
        }
        catch (e) {
            console.error('Failed to generate signedUrl for file:', e);
            return null;
        }
    }

    static async fillSignedUrlsForStruct(data: any, looped = new Set()) {
        if (data instanceof File) {
            return (await data.withSignedUrl()) ?? undefined; // never return null if it fails because we'll want to use the original file in that case
        }
        if (looped.has(data)) {
            return;
        }
        looped.add(data);

        if (Array.isArray(data)) {
            for (let i = 0; i < data.length; i++) {
                const value = data[i];
                const r = await this.fillSignedUrlsForStruct(value, looped);
                if (r !== undefined) {
                    data[i] = r;
                }
            }
            return;
        }

        if (data instanceof Map) {
            for (const [key, value] of data.entries()) {
                const r = await this.fillSignedUrlsForStruct(value, looped);

                if (r !== undefined) {
                    data.set(key, r);
                    continue;
                }
            }
            return;
        }

        // Loop all keys and search for File objects + replace them with the signed variant
        if (typeof data === 'object' && data !== null) {
            for (const key in data) {
                const r = await this.fillSignedUrlsForStruct(data[key], looped);
                if (r !== undefined) {
                    data[key] = r;
                }
            }
            return;
        }
    }

    static async verifyFilesInStruct(data: any, looped = new Set()) {
        if (looped.has(data)) {
            return;
        }
        looped.add(data);

        if (data instanceof File) {
            if (!data.isPrivate) {
                return;
            }

            // Clear all incoming signed urls
            data.signedUrl = null;

            if (!await data.verify()) {
                // This is the first level of defence - it prevents the server from storing untrusted files
                // but in the case this check is bypassed, we still need to check the signature when creating signed urls
                throw new SimpleError({
                    code: 'invalid_signature',
                    message: 'Invalid signature for file',
                    human: $t('479684ab-6c50-4ced-82d7-8245f4f475f4'),
                });
            }
            return;
        }

        if (Array.isArray(data)) {
            for (const value of data) {
                await this.verifyFilesInStruct(value, looped);
            }
            return;
        }

        if (data instanceof Map) {
            for (const [key, value] of data.entries()) {
                await this.verifyFilesInStruct(value, looped);
            }
            return;
        }

        // Loop all keys and search for File objects + replace them with the signed variant
        if (typeof data === 'object' && data !== null) {
            for (const key in data) {
                await this.verifyFilesInStruct(data[key], looped);
            }
            return;
        }
    }

    static async handleResponse(request: Request, response: Response) {
        const r = await this.fillSignedUrlsForStruct(response.body);
        if (r !== undefined) {
            response.body = r;
        }
    }

    static async handleDecodedRequest(decodedRequest: DecodedRequest<unknown, unknown, unknown>, _endpoint) {
        await this.verifyFilesInStruct(decodedRequest.body);
    }
}
