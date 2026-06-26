import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { run } from './command-runner.js';

type ReadOptions = {
    optional?: boolean;
    cacheDir?: string;
};

type CacheEntry = {
    version: 1;
    key: string;
    account: string;
    value: string;
    createdAt: string;
};

const cacheVersion = 1;
const defaultAccount = 'stamhoofd.1password.eu';
const memoryCache = new Map<string, Promise<string>>();

export async function read1PasswordCli(key: string, options: ReadOptions): Promise<string> {
    const account = process.env.STAMHOOFD_1PASSWORD_ACCOUNT ?? defaultAccount;
    const cacheKey = `${cacheVersion}:${account}:${key}`;

    if (process.env.STAMHOOFD_1PASSWORD_CACHE === '0') {
        return await read1PasswordCliUncached(key, account, options);
    }

    let cached = memoryCache.get(cacheKey);
    if (!cached) {
        cached = read1PasswordCliCached(key, account, options).catch((error: unknown) => {
            memoryCache.delete(cacheKey);
            throw error;
        });
        memoryCache.set(cacheKey, cached);
    }

    return await cached;
}

async function read1PasswordCliCached(key: string, account: string, options: ReadOptions): Promise<string> {
    let file: string | undefined;
    if (options.cacheDir) {
        file = cacheFile(options.cacheDir, account, key);
        const cached = await readFileCache(file, key, account);
        if (cached) {
            return cached;
        }
    }

    const value = await read1PasswordCliUncached(key, account, options);
    if (value) {
        if (file) {
            await writeFileCache(file, { version: cacheVersion, key, account, value, createdAt: new Date().toISOString() });
        }
    }
    return value;
}

async function read1PasswordCliUncached(key: string, account: string, options: ReadOptions): Promise<string> {
    const scoped = await run('op', ['read', '--account', account, key], { capture: true, allowFailure: true });
    if (scoped.status === 0) {
        return parseValue(scoped.stdout, key, options);
    }

    if (scoped.stderr.includes('found no accounts for filter')) {
        const unscoped = await run('op', ['read', key], { capture: true, allowFailure: true });
        if (unscoped.status === 0) {
            return parseValue(unscoped.stdout, key, options);
        }
        return handleFailure(key, options, unscoped.stderr);
    }

    return handleFailure(key, options, scoped.stderr);
}

function parseValue(stdout: string, key: string, options: ReadOptions): string {
    const value = stdout.endsWith('\n') ? stdout.slice(0, -1) : stdout;
    if (value === '' && !options.optional) {
        throw new Error(`Key not found in 1Password: ${key}`);
    }
    return value;
}

function handleFailure(key: string, options: ReadOptions, stderr: string): string {
    if (options.optional) {
        return '';
    }
    throw new Error(`Failed to read 1Password key ${key}${stderr.trim() ? `: ${stderr.trim()}` : ''}`);
}

async function readFileCache(file: string, key: string, account: string): Promise<string> {
    try {
        const entry = JSON.parse(await fs.readFile(file, 'utf-8')) as CacheEntry;
        if (entry.version === cacheVersion && entry.key === key && entry.account === account && entry.value) {
            return entry.value;
        }
    } catch {
        // Cache misses and corrupt cache files should not block development startup.
    }
    return '';
}

async function writeFileCache(file: string, entry: CacheEntry): Promise<void> {
    try {
        await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
        const tempFile = `${file}.${process.pid}.tmp`;
        await fs.writeFile(tempFile, JSON.stringify(entry, null, 4), { mode: 0o600 });
        await fs.rename(tempFile, file);
    } catch {
        // 1Password remains the source of truth; cache writes are best effort.
    }
}

function cacheFile(cacheDir: string, account: string, key: string): string {
    const hash = crypto.createHash('sha256').update(`${cacheVersion}:${account}:${key}`).digest('hex');
    return path.join(cacheDir, `${hash}.json`);
}
