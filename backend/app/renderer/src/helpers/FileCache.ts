import { SimpleError } from '@simonbackx/simple-errors';
import { promises as fs } from 'fs';

/**
 * This cache does not use a TTL. 
 * Instead it uses the updatedAt timestamp of a resource when caching. So we keep the cache forever unless the resource itself has changed.
 * The cache requester passes the updatedAt timestamp, so this works flawlessly.
 */
export class FileCache {
    static async write(cacheId: string, timestamp: Date, data: Uint8Array | Buffer) {
        if (cacheId.includes('/')) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Invalid cache id',
                field: 'cacheId',
            });
        }

        const folder = STAMHOOFD.CACHE_PATH + '/' + cacheId;
        await fs.mkdir(folder, { recursive: true });

        // Emtpy folder
        const files = await fs.readdir(folder);
        for (const file of files) {
            const fileTimestamp = parseInt(file.substring(0, file.length - 4));
            if (fileTimestamp <= timestamp.getTime()) {
                await fs.unlink(folder + '/' + file);
            }
        }

        const path = folder + '/' + timestamp.getTime() + '.pdf';
        await fs.writeFile(path, data);
    }

    static async read(cacheId: string, timestamp: Date): Promise<Buffer | null> {
        if (cacheId.includes('/')) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Invalid cache id',
                field: 'cacheId',
            });
        }

        const folder = STAMHOOFD.CACHE_PATH + '/' + cacheId;
        const path = folder + '/' + timestamp.getTime() + '.pdf';
        try {
            const data = await fs.readFile(path);
            return data;
        }
        catch {
            // ignore
        }

        try {
            const files = await fs.readdir(folder);
            for (const file of files) {
                const fileTimestamp = parseInt(file.substring(0, file.length - 4));
                if (fileTimestamp >= timestamp.getTime()) {
                    try {
                        const data = await fs.readFile(folder + '/' + file);
                        return data;
                    }
                    catch {
                        // ignore
                    }
                }
            }
        }
        catch {
            // ignore
        }

        return null;
    }
}
