/**
 * Since we need to build the environment for every running app, we want to cache some results
 * to prevent for example, prompting for 1Password credentials every time.
 *
 * On top of that, we want to pass data from the 'init' step to the 'build' step, such as the stripe webhook secret.
 */

import fs from 'node:fs/promises';
import { getProjectPath } from './project-path.js';

// Wait max 60 seconds to acquire the lock
const LOCK_RETRY_INTERVAL = 100; // ms
const MAX_RETRIES = 600;

function withTemporarySignalHandler(cleanup: () => Promise<void>) {
    const handleShutdown = () => {
        cleanup().then(() => {
            // Cleanup completed, exit the process
            process.exit(0); // Exit gracefully
        }).catch((err) => {
            console.error('Error during cleanup:', err);
        });
    };

    // Attach listeners
    process.on('SIGINT', handleShutdown);
    process.on('SIGTERM', handleShutdown);

    return () => {
        // Detach listeners
        process.off('SIGINT', handleShutdown);
        process.off('SIGTERM', handleShutdown);
    };
}

export async function withFileLock<T>(
    filePath: string,
    action: () => Promise<T>,
): Promise<T> {
    const lockPath = `${filePath}.lock`;
    let didLock = false; ;
    const cleanup = withTemporarySignalHandler(async () => {
        if (!didLock) return; // No need to clean up if we never acquired the lock
        try {
            await fs.unlink(lockPath);
            didLock = false; // Reset the lock state
        }
        catch (err) {
            // ignore
        }
    });

    try {
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            try {
                if (attempt > 0 && attempt * LOCK_RETRY_INTERVAL % 1000 === 0) {
                    console.log('Waiting for lock...');
                }

                const fd = await fs.open(lockPath, 'wx'); // 'wx' fails if exists
                await fd.close();
                didLock = true;

                try {
                    const result = await action(); // Do the actual file operation
                    try {
                        await fs.unlink(lockPath); // Release the lock
                    }
                    catch (err) {
                        // ignore
                    }
                    didLock = false;
                    return result;
                }
                catch (err) {
                    try {
                        await fs.unlink(lockPath); // Release the lock
                    }
                    catch (err) {
                        // ignore
                    }
                    didLock = false;
                    throw err;
                }
            }
            catch (err: any) {
                if (err.code !== 'EEXIST') throw err; // Unexpected error
                await sleep(LOCK_RETRY_INTERVAL);
            }
        }

        throw new Error(`Could not acquire lock for ${filePath} after ${MAX_RETRIES} attempts`);
    }
    finally {
        cleanup(); // Ensure cleanup is called on exit
    }
}

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Store the cache in the project root folder (yarn workspace root)
export async function cache(key: string, getValue?: () => Promise<string>) {
    const rootPath = await getProjectPath();

    // Create cache folder if it doesn't exist
    const cacheFolder = rootPath + '.cache';
    try {
        await fs.mkdir(cacheFolder, { recursive: true });
    }
    catch (error) {
        console.error('Failed to create cache folder:', error);
        throw error;
    }

    const filePath = `${cacheFolder}/${key}`;
    return await withFileLock(
        filePath,
        async () => {
            // First read to check if it is cached
            let cachedValue: string | null = null;
            try {
                cachedValue = await fs.readFile(filePath, 'utf-8');
                const decoded = JSON.parse(cachedValue);
                if (decoded && typeof decoded.date === 'number' && typeof decoded.value === 'string') {
                    const now = new Date().getTime();
                    const age = now - decoded.date;

                    // If the cache is older than 1 day, we consider it stale
                    if (age < 60 * 60 * 1000 * 24) {
                        return decoded.value; // Return cached value if it's still fresh
                    }
                }
            }
            catch (error) {
                if (error.code !== 'ENOENT') {
                    console.error('Failed to read cache file:', error);
                    throw error;
                }
            }

            // Write file
            if (!getValue) {
                throw new Error(key + ' is not cached, and cannot get fresh value');
            }
            const value = await getValue();
            const data = {
                date: new Date().getTime(),
                value,
            };

            // Write the value to the cache file
            await fs.writeFile(filePath, JSON.stringify(data), 'utf-8');
            return value;
        },
    );
}
