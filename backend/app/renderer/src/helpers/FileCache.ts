import { SimpleError } from '@common/errors';
import { promises as fs } from 'fs';

/**
 * This cache does not use a TTL.
 * Instead it uses the updatedAt timestamp of a resource when caching. So we keep the cache forever unless the resource itself has changed.
 * Reads only return the exact requested updatedAt timestamp, never a later version.
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

    /** Returns bytes for this exact resource version, or null when its file cannot be read. */
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

        return null;
    }
}
