import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { QueueHandler } from '@stamhoofd/queues';
import { HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { backup, cleanBackups } from './helpers/backup.js';
import './crons.js';

const { jobs, done, send, select } = vi.hoisted(() => ({
    jobs: new Map<string, () => Promise<void>>(),
    done: vi.fn(),
    send: vi.fn(),
    select: vi.fn(),
}));
vi.mock('@stamhoofd/crons', () => ({
    registerCron: (name: string, job: () => Promise<void>) => jobs.set(name, job),
}));
vi.mock('@node/database', () => ({ Database: { select } }));
vi.mock('@aws-sdk/client-s3', async (original) => ({
    ...(await original<typeof import('@aws-sdk/client-s3')>()),
    S3Client: class {
        send = send;
    },
}));
vi.mock('@aws-sdk/lib-storage', () => ({
    Upload: class {
        on() {}
        done = done;
    },
}));
vi.mock('child_process', () => ({ exec: (_cmd: string, cb: (error: null) => void) => cb(null) }));
vi.mock('fs', async (original) => {
    const fs = await original<typeof import('fs')>();
    const { Readable } = await import('node:stream');
    const createReadStream = () => Readable.from([Buffer.from('encrypted backup')]);
    return {
        ...fs,
        default: {
            ...fs,
            statSync: () => ({ size: 16 }),
            createReadStream,
        },
        createReadStream,
    };
});

const config = {
    environment: 'development',
    localBackupFolder: '/unused/',
    DB_DATABASE: 'test',
    DB_USER: 'test',
    DB_PASS: 'test',
    keyFingerprint: 'test',
    objectStoragePath: 'test',
    SPACES_ENDPOINT: 'unused.invalid',
    SPACES_BUCKET: 'test',
    SPACES_KEY: 'test',
    SPACES_SECRET: 'test',
    FULL_BACKUP_HEARTBEAT_URL: 'https://a.invalid/full',
    BINLOG_BACKUP_HEARTBEAT_URL: 'https://a.invalid/binlogs',
};
const request = vi.fn();
const ok = { $metadata: { httpStatusCode: 200 } };
const full = () => jobs.get('createBackups')!();
const binlogs = () => jobs.get('backupBinLogs')!();
function logs(...names: string[]) {
    select
        .mockResolvedValueOnce([[{ session_variables: { Value: '/unused/binlog' } }], []])
        .mockResolvedValueOnce([names.map((Log_name) => ({ '': { Log_name } })), []]);
}

beforeEach(() => {
    vi.stubGlobal('$t', (key: string) => key);
    vi.stubGlobal('STAMHOOFD', { ...config });
    vi.stubGlobal(
        'fetch',
        request.mockReset().mockResolvedValue(new Response(null, { status: 204 })),
    );
    vi.stubEnv('NODE_ENV', 'development');
    done.mockReset().mockResolvedValue(ok);
    send.mockReset().mockResolvedValue(ok);
});
afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.useRealTimers();
});

it('signals only a scheduled stored full backup; a busy queue or upload failure preserves the daily retry', async () => {
    vi.setSystemTime(new Date('2026-01-11T12:00Z'));
    await full();
    await cleanBackups();
    expect(done).not.toHaveBeenCalled();
    await backup(); // same helper used by the manual endpoint
    expect(request).not.toHaveBeenCalled();

    vi.setSystemTime(new Date('2026-01-12T02:00Z'));
    await QueueHandler.schedule('backup', full);
    expect(done).toHaveBeenCalledTimes(1);
    done.mockResolvedValueOnce({ $metadata: { httpStatusCode: 503 } });
    await expect(full()).rejects.toThrow('Failed to upload backup');
    expect(request).not.toHaveBeenCalled();
    await full();
    await full();
    expect(done).toHaveBeenCalledTimes(3);
    expect(request).toHaveBeenCalledExactlyOnceWith(
        config.FULL_BACKUP_HEARTBEAT_URL,
        expect.anything(),
    );
});

it('signals once after all binlogs including the active partial are stored, using only this host’s binlog URL', async () => {
    logs();
    await binlogs();
    expect(request).not.toHaveBeenCalled();
    const stored: string[] = [];
    send.mockImplementation((command) => {
        if (command instanceof HeadObjectCommand)
            throw Object.assign(new Error(), { name: 'NotFound' });
        if (command instanceof PutObjectCommand) {
            if (command.input.Key!.includes('.partial'))
                return { $metadata: { httpStatusCode: 500 } };
            stored.push(command.input.Key!);
        }
        return ok;
    });
    logs('binlog.1', 'binlog.2');
    await expect(binlogs()).rejects.toThrow('Failed to upload binlog');
    expect(stored).toHaveLength(1);
    expect(request).not.toHaveBeenCalled();
    send.mockResolvedValue(ok);
    for (const url of [
        config.BINLOG_BACKUP_HEARTBEAT_URL,
        undefined,
        'https://b.invalid/binlogs',
    ]) {
        vi.stubGlobal('STAMHOOFD', { ...config, BINLOG_BACKUP_HEARTBEAT_URL: url });
        logs('binlog.2');
        await binlogs();
    }
    expect(request.mock.calls.map(([url]) => url)).toEqual([
        config.BINLOG_BACKUP_HEARTBEAT_URL,
        'https://b.invalid/binlogs',
    ]);
});
