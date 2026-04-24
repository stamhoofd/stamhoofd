import { Formatter } from '@stamhoofd/utility';
import fs from 'fs/promises';
import path from 'path';

export class TTLFileCache {
    private cachePath: string;

    constructor(name: string, ttl: number) {
        if (!STAMHOOFD.CACHE_PATH) {
            throw new Error('Missing STAMHOOFD.CACHE_PATH')
        }
        this.cachePath = STAMHOOFD.CACHE_PATH + '/' + Formatter.slug(name)

        // Clear on boot
        this.purgeCache(ttl).catch(console.error)
    }

     keyToFilePath(key: string): string {
        // Percent-encode every character that isn't safe in a filename.
        // Using encoding rather than replacement ensures the mapping is
        // injective: no two distinct keys ever produce the same filename.
        // Safe set: alphanumerics, hyphen, underscore, period.
        // The percent sign itself is encoded as %25, so encoded output is
        // always unambiguously decodable.
        const safeKey = key.replace(/[^\w\-.]/g, (ch) => {
            return '%' + ch.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0');
        });
        return path.join(this.cachePath, safeKey);
    }


    async cacheFile(key: string, contents: string): Promise<void> {
        await fs.mkdir(this.cachePath, { recursive: true });
        await fs.writeFile(this.keyToFilePath(key), contents, 'utf-8');
    }

    async checkCache(key: string, ttlMs?: number): Promise<string | null> {
        const filePath = this.keyToFilePath(key);
        try {
            if (ttlMs !== undefined) {
                const stat = await fs.stat(filePath);
                if (stat.mtimeMs < Date.now() - ttlMs) {
                    return null;
                }
            }
            return await fs.readFile(filePath, 'utf-8');
        } catch (err: unknown) {
            if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
                return null;
            }
            throw err;
        }
    }

    async clear() {
        try {
            await fs.rm(this.cachePath, {recursive: true})
        } catch (e) {
            // ignore
        }
    }

    async purgeCache(ttlMs: number): Promise<void> {
        let entries: string[];

        try {
            entries = await fs.readdir(this.cachePath);
        } catch (err: unknown) {
            if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
                return; // Cache directory doesn't exist yet — nothing to purge
            }
            throw err;
        }

        const cutoff = Date.now() - ttlMs;

        await Promise.all(
            entries.map(async (entry) => {
                const filePath = path.join(this.cachePath, entry);
                try {
                    const stat = await fs.stat(filePath);
                    if (stat.isFile() && stat.mtimeMs < cutoff) {
                        await fs.unlink(filePath);
                    }
                } catch {
                    // File may have been deleted concurrently — ignore
                }
            })
        );
    }
}
