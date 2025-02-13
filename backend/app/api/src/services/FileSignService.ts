import { Request, Response } from '@simonbackx/simple-endpoints';
import { File } from '@stamhoofd/structures';
import AWS from 'aws-sdk';

export class FileSignService {
    static s3 = new AWS.S3({
        endpoint: STAMHOOFD.SPACES_ENDPOINT,
        accessKeyId: STAMHOOFD.SPACES_KEY,
        secretAccessKey: STAMHOOFD.SPACES_SECRET,
    });

    static async signFile(file: File, duration = 60 * 60) {
        if (!file.isPrivate) {
            if (file.signedUrl) {
                console.error('Warning: file signed');
            }

            return;
        }
        console.log('Signing file:', file.id);

        if (file.signedUrl) {
            console.error('Warning: file already signed');
        }

        try {
            const url = await this.s3.getSignedUrlPromise('getObject', {
                Bucket: STAMHOOFD.SPACES_BUCKET,
                Key: file.path,
                Expires: duration,
            });

            console.log('Signed url:', url);

            return new File({
                ...file,
                signedUrl: url,
            });
        }
        catch (e) {
            console.error('Failed to sign file:', e);
            return file;
        }
    }

    static async signAllFilesInStruct(data: any) {
        if (data instanceof File) {
            return await this.signFile(data);
        }

        if (Array.isArray(data)) {
            for (let i = 0; i < data.length; i++) {
                const value = data[i];
                const r = await this.signAllFilesInStruct(value);
                if (r !== undefined) {
                    data[i] = r;
                }
            }
            return;
        }

        if (data instanceof Map) {
            for (const [key, value] of data.entries()) {
                const r = await this.signAllFilesInStruct(value);

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
                const r = await this.signAllFilesInStruct(data[key]);
                if (r !== undefined) {
                    data[key] = r;
                }
            }
            return;
        }
    }

    static async handleResponse(request: Request, response: Response) {
        const r = await this.signAllFilesInStruct(response.body);
        if (r !== undefined) {
            response.body = r;
        }
    }
}
