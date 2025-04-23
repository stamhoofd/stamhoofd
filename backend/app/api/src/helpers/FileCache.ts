import { SimpleError } from '@simonbackx/simple-errors';
import { Formatter } from '@stamhoofd/utility';
import basex from 'base-x';
import crypto from 'crypto';
import fs from 'node:fs';
import { Writable } from 'node:stream';
import { Readable } from 'stream';

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';
const baseEncoder = basex(ALPHABET);

async function randomBytes(size: number): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        crypto.randomBytes(size, (err: Error | null, buf: Buffer) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(buf);
        });
    });
}

export class FileCache {
    static async getWriteStream(extension: '.xlsx'): Promise<{
        file: string;
        stream: Writable;
    }> {
        if (!STAMHOOFD.CACHE_PATH) {
            throw new SimpleError({
                code: 'not_configured',
                message: 'CACHE_PATH environment variable is not configured',
                statusCode: 500,
            });
        }

        // Generate a long and unguessable filename
        const fileName = baseEncoder.encode(await randomBytes(100)).toLowerCase() + extension;
        const path = Formatter.dateIso(new Date());

        // Save in folder with the current day
        // Since this contains the day, we can easily restrict access to files after 1 day
        const folder = STAMHOOFD.CACHE_PATH + '/' + path;
        await fs.promises.mkdir(folder, { recursive: true });

        const s = fs.createWriteStream(folder + '/' + fileName, 'binary');

        s.on('close', () => {
            console.log('FileCache closed file: File written to disk', folder + '/' + fileName);
        });

        return {
            file: path + '/' + fileName,
            stream: s,
        };
    }

    static async read(file: string, dayTimeout = 1): Promise<{ stream: Readable; contentLength: number; extension: string }> {
        const splitted = file.split('/');
        if (splitted.length !== 2) {
            throw new SimpleError({
                code: 'invalid_file',
                message: 'Invalid file',
                human: $t(`Ongeldig bestand`),
                statusCode: 400,
            });
        }

        const fileName = splitted[1];

        const extension = fileName.substring(fileName.length - 5);
        if (extension !== '.xlsx') {
            throw new SimpleError({
                code: 'invalid_file',
                message: 'Invalid file',
                human: $t(`Ongeldig bestand`),
                statusCode: 400,
            });
        }

        const fileNameWithoutExtension = fileName.substring(0, fileName.length - 5);

        // Verify filename alphabet matching ALPHABET
        for (const char of fileNameWithoutExtension) {
            if (!ALPHABET.includes(char)) {
                throw new SimpleError({
                    code: 'invalid_file',
                    message: 'Invalid file',
                    human: $t(`Onbekend karakters in bestandsnaam`),
                    statusCode: 400,
                });
            }
        }

        const path = splitted[0];

        // Verify date
        if (path.length !== 10) {
            throw new SimpleError({
                code: 'invalid_file',
                message: 'Invalid file',
                human: $t(`Ongelidge datum`),
                statusCode: 400,
            });
        }
        const year = parseInt(path.substring(0, 4));
        const month = parseInt(path.substring(5, 5 + 2));
        const day = parseInt(path.substring(8, 8 + 2));

        if (isNaN(year) || isNaN(month) || isNaN(day)) {
            throw new SimpleError({
                code: 'invalid_file',
                message: 'Invalid file',
                human: $t(`Ongeldige datum`),
                statusCode: 400,
            });
        }

        const date = new Date(year, month - 1, day, 0, 0, 0);
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        const diff = now.getTime() - date.getTime();

        if (date > now || diff > dayTimeout * 24 * 60 * 60 * 1000) {
            throw new SimpleError({
                code: 'file_expired',
                message: 'File expired',
                human: $t(`Het bestand is verlopen`),
                statusCode: 404,
            });
        }

        const filePath = STAMHOOFD.CACHE_PATH + '/' + Formatter.dateIso(date) + '/' + fileName;

        let stat: fs.Stats;
        try {
            stat = await fs.promises.stat(filePath);
        }
        catch (e) {
            if (e.code == 'ENOENT') {
                throw new SimpleError({
                    code: 'file_expired',
                    message: 'File expired',
                    human: $t(`Het bestand bestaat niet`),
                    statusCode: 404,
                });
            }
            throw e;
        }

        return {
            stream: fs.createReadStream(filePath),
            contentLength: stat.size,
            extension,
        };
    }
}
