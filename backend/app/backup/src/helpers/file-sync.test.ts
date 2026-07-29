import type { FileSyncConfig, S3Sender } from './file-sync.js';
import { discoverDays, getFileSyncHealth, syncFiles } from './file-sync.js';
import { Readable } from 'node:stream';

type FakeObject = {
    body: string;
    size: number;
    acl: 'private' | 'public-read';
    contentType?: string;
    contentDisposition?: string;
    cacheControl?: string;
};

type RestoreOnGet = {
    onCall: number;
    bucket: string;
    key: string;
    object: Partial<FakeObject> & { body?: string };
};

class FakeS3 {
    config = {
        requestHandler: {},
        endpoint: async () => ({ protocol: 'https:', hostname: 'objects.example.com' }),
        forcePathStyle: true,
        requestChecksumCalculation: async () => 'WHEN_SUPPORTED',
    };

    objects = new Map<string, FakeObject>();
    deleted: string[] = [];
    copies: string[] = [];
    events: string[] = [];
    pageSize = Number.POSITIVE_INFINITY;
    failCopySourceOnce: string | null = null;
    copyDelayMs = 0;
    activeCopies = 0;
    maxActiveCopies = 0;
    copyAttempts = new Map<string, number>();
    copyFailures = new Map<string, { remaining: number; statusCode: number }>();
    copyRequests: Array<{ bucket: string; key: string; copySource: string; acl?: string }> = [];
    restoreOnGet = new Map<string, RestoreOnGet>();
    getAttempts = new Map<string, number>();
    deleteFailures = new Map<string, number>();
    deleteAttempts = new Map<string, number>();

    put(bucket: string, key: string, object: Partial<FakeObject> & { body?: string } = {}) {
        const body = object.body ?? '';
        this.objects.set(`${bucket}/${key}`, {
            body,
            size: object.size ?? Buffer.byteLength(body),
            acl: object.acl ?? 'private',
            contentType: object.contentType,
            contentDisposition: object.contentDisposition,
            cacheControl: object.cacheControl,
        });
    }

    get(bucket: string, key: string): FakeObject | undefined {
        return this.objects.get(`${bucket}/${key}`);
    }

    remove(bucket: string, key: string) {
        this.objects.delete(`${bucket}/${key}`);
    }

    async send(command: { constructor: { name: string }; input: Record<string, unknown> }): Promise<unknown> {
        const input = command.input as {
            Bucket: string;
            Key?: string;
            Prefix?: string;
            Delimiter?: string;
            CopySource?: string;
            ContinuationToken?: string;
            MaxKeys?: number;
            Body?: unknown;
            ACL?: 'private' | 'public-read';
            ContentType?: string;
            ContentDisposition?: string;
            CacheControl?: string;
        };
        switch (command.constructor.name) {
            case 'ListObjectsV2Command': {
                const prefix = input.Prefix ?? '';
                this.events.push(`list:${input.Bucket}:${prefix}:${input.ContinuationToken ?? ''}`);
                const matching = [...this.objects.entries()]
                    .filter(([storageKey]) => storageKey.startsWith(`${input.Bucket}/${prefix}`))
                    .map(([storageKey, object]) => ({
                        Key: storageKey.slice(input.Bucket.length + 1),
                        Size: object.size,
                    }))
                    .sort((a, b) => a.Key.localeCompare(b.Key));
                if (!input.Delimiter) {
                    const start = input.ContinuationToken
                        ? matching.findIndex(object => object.Key > input.ContinuationToken!)
                        : 0;
                    if (start === -1) {
                        return { Contents: [] };
                    }
                    const pageSize = Math.min(input.MaxKeys ?? this.pageSize, this.pageSize);
                    const contents = matching.slice(start, start + pageSize);
                    const next = start + contents.length;
                    return {
                        Contents: contents,
                        NextContinuationToken: next < matching.length ? contents.at(-1)?.Key : undefined,
                    };
                }
                const commonPrefixes = new Set<string>();
                const contents: typeof matching = [];
                for (const object of matching) {
                    const remainder = object.Key.slice(prefix.length);
                    const delimiterIndex = remainder.indexOf(input.Delimiter);
                    if (delimiterIndex === -1) {
                        contents.push(object);
                    }
                    else {
                        commonPrefixes.add(prefix + remainder.slice(0, delimiterIndex + 1));
                    }
                }
                const sortedPrefixes = [...commonPrefixes].sort();
                const prefixStart = input.ContinuationToken
                    ? sortedPrefixes.findIndex(item => item > input.ContinuationToken!)
                    : 0;
                if (prefixStart === -1) {
                    return { Contents: [] };
                }
                const pageSize = Math.min(input.MaxKeys ?? this.pageSize, this.pageSize);
                const prefixPage = sortedPrefixes.slice(prefixStart, prefixStart + pageSize);
                const next = prefixStart + prefixPage.length;
                return {
                    Contents: contents,
                    CommonPrefixes: prefixPage.map(Prefix => ({ Prefix })),
                    NextContinuationToken: next < sortedPrefixes.length ? prefixPage.at(-1) : undefined,
                };
            }
            case 'GetObjectAclCommand': {
                const object = this.require(input.Bucket, input.Key!);
                return {
                    Grants: object.acl === 'public-read'
                        ? [{
                                Grantee: { URI: 'http://acs.amazonaws.com/groups/global/AllUsers' },
                                Permission: 'READ',
                            }]
                        : [],
                };
            }
            case 'CopyObjectCommand': {
                const source = decodeURIComponent(input.CopySource!);
                const slash = source.indexOf('/');
                const sourceBucket = source.slice(0, slash);
                const sourceKey = source.slice(slash + 1);
                const sourceStorageKey = `${sourceBucket}/${sourceKey}`;
                this.copyAttempts.set(sourceStorageKey, (this.copyAttempts.get(sourceStorageKey) ?? 0) + 1);
                if (this.failCopySourceOnce === `${sourceBucket}/${sourceKey}`) {
                    this.failCopySourceOnce = null;
                    throw new Error('Injected copy interruption');
                }
                const plannedFailure = this.copyFailures.get(sourceStorageKey);
                if (plannedFailure && plannedFailure.remaining > 0) {
                    plannedFailure.remaining--;
                    throw Object.assign(new Error(`Injected ${plannedFailure.statusCode} copy failure`), {
                        $metadata: { httpStatusCode: plannedFailure.statusCode },
                    });
                }
                const object = this.require(sourceBucket, sourceKey);
                this.events.push(`copy:${input.Bucket}:${input.Key}`);
                this.copyRequests.push({
                    bucket: input.Bucket,
                    key: input.Key!,
                    copySource: input.CopySource!,
                    acl: input.ACL,
                });
                this.activeCopies++;
                this.maxActiveCopies = Math.max(this.maxActiveCopies, this.activeCopies);
                try {
                    if (this.copyDelayMs > 0) {
                        await new Promise(resolve => setTimeout(resolve, this.copyDelayMs));
                    }
                    this.put(input.Bucket, input.Key!, { ...object, acl: input.ACL });
                    this.copies.push(`${input.Bucket}/${input.Key}`);
                    return {};
                }
                finally {
                    this.activeCopies--;
                }
            }
            case 'GetObjectCommand': {
                const storageKey = `${input.Bucket}/${input.Key}`;
                const attempt = (this.getAttempts.get(storageKey) ?? 0) + 1;
                this.getAttempts.set(storageKey, attempt);
                const restoration = this.restoreOnGet.get(storageKey);
                if (restoration?.onCall === attempt) {
                    this.put(restoration.bucket, restoration.key, restoration.object);
                }
                const object = this.get(input.Bucket, input.Key!);
                if (!object) {
                    throw Object.assign(new Error('Not found'), { name: 'NoSuchKey' });
                }
                const body = Readable.from([object.body]) as Readable & { transformToString(): Promise<string> };
                body.transformToString = async () => object.body;
                return {
                    Body: body,
                    ContentType: object.contentType,
                    ContentDisposition: object.contentDisposition,
                    CacheControl: object.cacheControl,
                };
            }
            case 'PutObjectCommand': {
                const body = await bodyToString(input.Body);
                this.put(input.Bucket, input.Key!, {
                    body,
                    acl: input.ACL,
                    contentType: input.ContentType,
                    contentDisposition: input.ContentDisposition,
                    cacheControl: input.CacheControl,
                });
                return {};
            }
            case 'DeleteObjectCommand': {
                const storageKey = `${input.Bucket}/${input.Key}`;
                this.deleteAttempts.set(storageKey, (this.deleteAttempts.get(storageKey) ?? 0) + 1);
                const failuresRemaining = this.deleteFailures.get(storageKey) ?? 0;
                if (failuresRemaining > 0) {
                    this.deleteFailures.set(storageKey, failuresRemaining - 1);
                    throw Object.assign(new Error('Injected delete failure'), {
                        $metadata: { httpStatusCode: 503 },
                    });
                }
                this.deleted.push(storageKey);
                this.remove(input.Bucket, input.Key!);
                return {};
            }
            default:
                throw new Error(`Unsupported command ${command.constructor.name}`);
        }
    }

    private require(bucket: string, key: string): FakeObject {
        const object = this.get(bucket, key);
        if (!object) {
            throw new Error(`Missing fake object ${bucket}/${key}`);
        }
        return object;
    }
}

const config: FileSyncConfig = {
    source: {
        endpoint: 'objects.example.com',
        bucket: 'source',
        key: 'source-key',
        secret: 'source-secret',
        prefix: 'source-root/',
    },
    replica: {
        endpoint: 'objects.example.com',
        bucket: 'replica',
        key: 'replica-key',
        secret: 'replica-secret',
        prefix: 'replica-root/',
    },
    fullReverifyDays: 7,
};

function sender(fake: FakeS3): S3Sender {
    return fake as unknown as S3Sender;
}

describe('file sync', () => {
    test('copies missing and mismatched objects while preserving source ACLs', async () => {
        const fake = new FakeS3();
        fake.pageSize = 1;
        const day = '2026/07/28';
        const publicKey = `d/${day}/p/image/public.jpg`;
        const privateUnderPublicKey = `d/${day}/p/image/source.jpg`;
        const privateKey = `d/${day}/users/user/file/document.pdf`;
        const missingFromSourceKey = `d/${day}/p/image/orphan.jpg`;
        fake.put('source', `source-root/${publicKey}`, { body: 'public', acl: 'public-read' });
        fake.put('source', `source-root/${privateUnderPublicKey}`, { body: 'original', acl: 'private' });
        fake.put('source', `source-root/${privateKey}`, { body: 'private', acl: 'private' });
        fake.put('replica', `replica-root/${publicKey}`, { body: 'public', acl: 'public-read' });
        fake.put('replica', `replica-root/${privateKey}`, { body: 'x', acl: 'public-read' });
        fake.put('replica', `replica-root/${missingFromSourceKey}`, { body: 'orphan', acl: 'private' });

        await syncFiles(new Date('2026-07-28T12:00:00.000Z'), {
            config,
            sourceClient: sender(fake),
            replicaClient: sender(fake),
        });

        expect(fake.get('replica', `replica-root/${publicKey}`)?.acl).toBe('public-read');
        expect(fake.get('replica', `replica-root/${privateUnderPublicKey}`)?.acl).toBe('private');
        expect(fake.get('replica', `replica-root/${privateKey}`)).toMatchObject({
            body: 'private',
            acl: 'private',
        });
        expect(readState(fake, 'replica-root/_sync/days/2026/07/28.json').missingFiles[missingFromSourceKey]).toBeDefined();
        expect(fake.copies).toHaveLength(2);

        fake.copies = [];
        await syncFiles(new Date('2026-07-28T13:00:00.000Z'), {
            config,
            sourceClient: sender(fake),
            replicaClient: sender(fake),
        });
        expect(fake.copies).toHaveLength(0);
    });

    test('starts copying before all listing pages have been loaded', async () => {
        const fake = new FakeS3();
        fake.pageSize = 1;
        fake.copyDelayMs = 2;
        const dayPrefix = 'source-root/d/2026/07/28/';
        for (let index = 0; index < 40; index++) {
            const id = index.toString().padStart(2, '0');
            fake.put('source', `${dayPrefix}p/${id}/file.jpg`, {
                body: `file-${id}`,
                acl: 'public-read',
            });
        }

        await run(fake, '2026-07-28T12:00:00.000Z');

        const dayListingEvents = fake.events
            .map((event, index) => ({ event, index }))
            .filter(({ event }) => event.startsWith(`list:source:${dayPrefix}`));
        const firstCopyIndex = fake.events.findIndex(event => event.startsWith('copy:replica:replica-root/d/2026/07/28/'));

        expect(dayListingEvents).toHaveLength(40);
        expect(firstCopyIndex).toBeGreaterThan(-1);
        expect(firstCopyIndex).toBeLessThan(dayListingEvents.at(-1)!.index);
        expect(fake.copies.filter(key => key.includes('/d/2026/07/28/'))).toHaveLength(40);
        expect(fake.maxActiveCopies).toBeGreaterThan(1);
        expect(fake.maxActiveCopies).toBeLessThanOrEqual(15);
    });

    test('waits for active copies after a streamed copy fails and safely resumes later', async () => {
        const fake = new FakeS3();
        fake.pageSize = 1;
        fake.copyDelayMs = 2;
        const dayPrefix = 'source-root/d/2026/07/28/';
        for (let index = 0; index < 20; index++) {
            const id = index.toString().padStart(2, '0');
            fake.put('source', `${dayPrefix}p/${id}/file.jpg`, {
                body: `file-${id}`,
                acl: 'public-read',
            });
        }
        fake.failCopySourceOnce = `source/${dayPrefix}p/05/file.jpg`;

        await expect(run(fake, '2026-07-28T12:00:00.000Z')).rejects.toThrow('Injected copy interruption');

        expect(fake.activeCopies).toBe(0);
        expect(fake.get('replica', 'replica-root/_sync/days/2026/07/28.json')).toBeUndefined();

        await run(fake, '2026-07-28T13:00:00.000Z');

        for (let index = 0; index < 20; index++) {
            const id = index.toString().padStart(2, '0');
            expect(fake.get('replica', `replica-root/d/2026/07/28/p/${id}/file.jpg`)).toBeDefined();
        }
    });

    test('records missing files, preserves the first timestamp, deletes after 90 days, and handles files returning', async () => {
        const fake = new FakeS3();
        const relativeKey = 'd/2026/07/28/p/file/photo.jpg';
        fake.put('source', `source-root/${relativeKey}`, { body: 'photo', acl: 'public-read' });
        await run(fake, '2026-07-28T12:00:00.000Z');

        fake.remove('source', `source-root/${relativeKey}`);
        await run(fake, '2026-08-01T12:00:00.000Z');
        const firstState = readState(fake, 'replica-root/_sync/days/2026/07/28.json');
        expect(firstState.missingFiles[relativeKey].firstMissingAt).toBe('2026-08-01T12:00:00.000Z');
        expect(fake.get('replica', `replica-root/${relativeKey}`)).toBeDefined();

        await run(fake, '2026-10-29T12:00:00.000Z');
        const secondState = readState(fake, 'replica-root/_sync/days/2026/07/28.json');
        expect(secondState.missingFiles[relativeKey].firstMissingAt).toBe('2026-08-01T12:00:00.000Z');
        expect(fake.get('replica', `replica-root/${relativeKey}`)).toBeDefined();

        fake.put('source', `source-root/${relativeKey}`, { body: 'photo', acl: 'public-read' });
        await run(fake, '2026-10-30T12:00:00.000Z');
        expect(readState(fake, 'replica-root/_sync/days/2026/07/28.json').missingFiles[relativeKey]).toBeUndefined();

        fake.remove('source', `source-root/${relativeKey}`);
        await run(fake, '2026-10-31T12:00:00.000Z');
        await run(fake, '2027-01-31T12:00:00.000Z');
        expect(fake.get('replica', `replica-root/${relativeKey}`)).toBeUndefined();
    });

    test('discovers only populated day prefixes across boundaries', async () => {
        const fake = new FakeS3();
        fake.put('source', 'source-root/d/2025/12/31/p/a/a.jpg');
        fake.put('source', 'source-root/d/2026/01/01/p/b/b.jpg');
        fake.put('source', 'source-root/p/legacy/file.jpg');

        await expect(discoverDays({
            client: sender(fake),
            config: config.source,
        })).resolves.toEqual([
            '2025-12-31',
            '2026-01-01',
        ]);
        await expect(discoverDays({
            client: sender(fake),
            config: config.source,
            startDate: '2026-01-01',
        })).resolves.toEqual([
            '2026-01-01',
        ]);
    });

    test('resumes an interrupted paginated legacy sweep without copying completed pages again', async () => {
        const fake = new FakeS3();
        fake.pageSize = 1;
        fake.put('source', 'source-root/p/a/first.jpg', { body: 'first', acl: 'public-read' });
        fake.put('source', 'source-root/users/user/b/second.jpg', { body: 'second', acl: 'private' });
        fake.put('source', 'source-root/d/2026/07/28/p/c/grouped.jpg', { body: 'grouped', acl: 'public-read' });
        fake.failCopySourceOnce = 'source/source-root/users/user/b/second.jpg';

        await expect(run(fake, '2026-07-28T12:00:00.000Z')).rejects.toThrow('Injected copy interruption');
        expect(fake.get('replica', 'replica-root/p/a/first.jpg')).toBeDefined();
        expect(fake.get('replica', 'replica-root/users/user/b/second.jpg')).toBeUndefined();

        await run(fake, '2026-07-28T13:00:00.000Z');

        expect(fake.get('replica', 'replica-root/users/user/b/second.jpg')?.acl).toBe('private');
        expect(fake.copies.filter(key => key === 'replica/replica-root/p/a/first.jpg')).toHaveLength(1);
        expect(readState(fake, 'replica-root/_sync/legacy.json')).toMatchObject({
            completedAt: '2026-07-28T13:00:00.000Z',
            objectCount: 2,
        });
    });

    test('records mass deletion but does not delete any expired files in that run', async () => {
        const fake = new FakeS3();
        const now = new Date('2026-07-28T12:00:00.000Z');
        const newlyMissingKey = 'd/2026/07/28/p/new/missing.jpg';
        const expiredMissingKey = 'd/2026/07/27/p/old/expired.jpg';
        fake.put('replica', `replica-root/${newlyMissingKey}`, { body: 'new' });
        fake.put('replica', `replica-root/${expiredMissingKey}`, { body: 'old' });
        fake.put('replica', 'replica-root/_sync/days/2026/07/27.json', {
            body: JSON.stringify({
                day: '2026-07-27',
                lastVerifiedAt: '2026-01-01T00:00:00.000Z',
                objectCount: 1,
                missingFiles: {
                    [expiredMissingKey]: {
                        firstMissingAt: '2026-01-01T00:00:00.000Z',
                        size: 3,
                    },
                },
            }),
        });

        await syncFiles(now, {
            config,
            sourceClient: sender(fake),
            replicaClient: sender(fake),
        });

        expect(fake.get('replica', `replica-root/${newlyMissingKey}`)).toBeDefined();
        expect(fake.get('replica', `replica-root/${expiredMissingKey}`)).toBeDefined();
        expect(readState(fake, 'replica-root/_sync/days/2026/07/28.json').missingFiles[newlyMissingKey]).toBeDefined();
        expect(getFileSyncHealth().error).toBe('Mass deletion detected');
        expect(fake.deleted).toHaveLength(0);
    });

    test('treats a corrupt day state as new and does not delete the replica file', async () => {
        const fake = new FakeS3();
        const relativeKey = 'd/2026/07/28/p/file/photo.jpg';
        const stateKey = 'replica-root/_sync/days/2026/07/28.json';
        fake.put('replica', `replica-root/${relativeKey}`, { body: 'photo' });
        fake.put('replica', stateKey, { body: '{broken json' });

        await run(fake, '2026-07-28T12:00:00.000Z');

        expect(fake.get('replica', `replica-root/${relativeKey}`)).toBeDefined();
        expect(fake.deleted).toHaveLength(0);
        expect(readState(fake, stateKey).missingFiles[relativeKey]).toEqual({
            firstMissingAt: '2026-07-28T12:00:00.000Z',
            size: 5,
        });
    });

    test('treats a structurally invalid day state as untrusted and replaces it safely', async () => {
        const fake = new FakeS3();
        const relativeKey = 'd/2026/07/28/p/file/photo.jpg';
        const stateKey = 'replica-root/_sync/days/2026/07/28.json';
        fake.put('replica', `replica-root/${relativeKey}`, { body: 'photo' });
        fake.put('replica', stateKey, {
            body: JSON.stringify({
                day: '2026-07-27',
                lastVerifiedAt: '2026-01-01T00:00:00.000Z',
                objectCount: 1,
                missingFiles: {
                    'd/2026/07/27/p/unrelated.jpg': {
                        firstMissingAt: '2026-01-01T00:00:00.000Z',
                        size: 5,
                    },
                },
            }),
        });

        await run(fake, '2026-07-28T12:00:00.000Z');

        expect(fake.deleted).toHaveLength(0);
        expect(fake.get('replica', `replica-root/${relativeKey}`)).toBeDefined();
        expect(readState(fake, stateKey)).toMatchObject({
            day: '2026-07-28',
            missingFiles: {
                [relativeKey]: {
                    firstMissingAt: '2026-07-28T12:00:00.000Z',
                },
            },
        });
    });

    test('keeps a file at 89 days missing and deletes it after 91 days', async () => {
        const now = new Date('2026-07-28T12:00:00.000Z');
        const relativeKey = 'd/2026/07/28/p/file/photo.jpg';
        const stateKey = 'replica-root/_sync/days/2026/07/28.json';

        for (const [missingDays, shouldDelete] of [[89, false], [91, true]] as const) {
            const fake = new FakeS3();
            fake.put('replica', `replica-root/${relativeKey}`, { body: 'photo' });
            fake.put('replica', stateKey, {
                body: JSON.stringify(dayState({
                    day: '2026-07-28',
                    missingFiles: {
                        [relativeKey]: {
                            firstMissingAt: new Date(now.getTime() - missingDays * 24 * 60 * 60 * 1000).toISOString(),
                            size: 5,
                        },
                    },
                })),
            });

            await syncFiles(now, {
                config,
                sourceClient: sender(fake),
                replicaClient: sender(fake),
            });

            expect(fake.get('replica', `replica-root/${relativeKey}`) === undefined).toBe(shouldDelete);
        }
    });

    test('does not delete an expired file that returns to the source just before deletion', async () => {
        const fake = new FakeS3();
        const relativeKey = 'd/2026/07/28/p/file/photo.jpg';
        const stateKey = 'replica-root/_sync/days/2026/07/28.json';
        fake.put('replica', `replica-root/${relativeKey}`, { body: 'photo', acl: 'public-read' });
        fake.put('replica', stateKey, {
            body: JSON.stringify(dayState({
                day: '2026-07-28',
                missingFiles: {
                    [relativeKey]: {
                        firstMissingAt: '2026-01-01T00:00:00.000Z',
                        size: 5,
                    },
                },
            })),
        });
        fake.restoreOnGet.set(`replica/${stateKey}`, {
            onCall: 2,
            bucket: 'source',
            key: `source-root/${relativeKey}`,
            object: { body: 'photo', acl: 'public-read' },
        });

        await run(fake, '2026-07-28T12:00:00.000Z');

        expect(fake.get('replica', `replica-root/${relativeKey}`)).toBeDefined();
        expect(fake.deleted).toHaveLength(0);
        expect(readState(fake, stateKey).missingFiles[relativeKey]).toBeUndefined();
    });

    test('keeps deletion state after a storage failure and retries safely on the next run', async () => {
        const fake = new FakeS3();
        const relativeKey = 'd/2026/07/28/p/file/photo.jpg';
        const replicaStorageKey = `replica/replica-root/${relativeKey}`;
        const stateKey = 'replica-root/_sync/days/2026/07/28.json';
        fake.put('replica', `replica-root/${relativeKey}`, { body: 'photo' });
        fake.put('replica', stateKey, {
            body: JSON.stringify(dayState({
                day: '2026-07-28',
                missingFiles: {
                    [relativeKey]: {
                        firstMissingAt: '2026-01-01T00:00:00.000Z',
                        size: 5,
                    },
                },
            })),
        });
        fake.deleteFailures.set(replicaStorageKey, 1);

        await expect(run(fake, '2026-07-28T12:00:00.000Z')).rejects.toThrow('Injected delete failure');
        expect(fake.get('replica', `replica-root/${relativeKey}`)).toBeDefined();
        expect(readState(fake, stateKey).missingFiles[relativeKey]).toBeDefined();

        await run(fake, '2026-07-28T13:00:00.000Z');

        expect(fake.deleteAttempts.get(replicaStorageKey)).toBe(2);
        expect(fake.get('replica', `replica-root/${relativeKey}`)).toBeUndefined();
        expect(readState(fake, stateKey).missingFiles[relativeKey]).toBeUndefined();
    });

    test('triggers the configured absolute missing-file limit below the percentage limit', async () => {
        const fake = new FakeS3();
        const dayPrefix = 'd/2026/07/28/p/';
        for (let index = 0; index < 20; index++) {
            const relativeKey = `${dayPrefix}matching-${index.toString().padStart(2, '0')}/file.jpg`;
            fake.put('source', `source-root/${relativeKey}`, { body: 'same' });
            fake.put('replica', `replica-root/${relativeKey}`, { body: 'same' });
        }
        for (let index = 0; index < 3; index++) {
            fake.put('replica', `replica-root/${dayPrefix}missing-${index}/file.jpg`, { body: 'missing' });
        }

        await run(fake, '2026-07-28T12:00:00.000Z', {
            ...config,
            maxNewMissingFilesPerRun: 2,
        });

        expect(getFileSyncHealth().error).toBe('Mass deletion detected');
        expect(fake.deleted).toHaveLength(0);
    });

    test('does not trigger mass-deletion protection at exactly twenty percent', async () => {
        const fake = new FakeS3();
        const dayPrefix = 'd/2026/07/28/p/';
        for (let index = 0; index < 4; index++) {
            const relativeKey = `${dayPrefix}matching-${index}/file.jpg`;
            fake.put('source', `source-root/${relativeKey}`, { body: 'same' });
            fake.put('replica', `replica-root/${relativeKey}`, { body: 'same' });
        }
        fake.put('replica', `replica-root/${dayPrefix}missing/file.jpg`, { body: 'missing' });

        await run(fake, '2026-07-28T12:00:00.000Z');

        expect(getFileSyncHealth().error).toBeNull();
    });

    test('retries temporary copy failures but does not retry a permanent failure', async () => {
        const relativeKey = 'd/2026/07/28/p/file/photo%20%231.jpg';
        const sourceStorageKey = `source/source-root/${relativeKey}`;
        const retryingFake = new FakeS3();
        retryingFake.put('source', `source-root/${relativeKey}`, { body: 'photo', acl: 'public-read' });
        retryingFake.copyFailures.set(sourceStorageKey, { remaining: 2, statusCode: 503 });

        await run(retryingFake, '2026-07-28T12:00:00.000Z');

        expect(retryingFake.copyAttempts.get(sourceStorageKey)).toBe(3);
        expect(retryingFake.get('replica', `replica-root/${relativeKey}`)).toBeDefined();

        const failingFake = new FakeS3();
        failingFake.put('source', `source-root/${relativeKey}`, { body: 'photo' });
        failingFake.copyFailures.set(sourceStorageKey, { remaining: 5, statusCode: 403 });

        await expect(run(failingFake, '2026-07-28T12:00:00.000Z')).rejects.toThrow('Injected 403 copy failure');
        expect(failingFake.copyAttempts.get(sourceStorageKey)).toBe(1);
        expect(failingFake.get('replica', 'replica-root/_sync/days/2026/07/28.json')).toBeUndefined();
    });

    test('encodes special characters in server-side copy requests', async () => {
        const fake = new FakeS3();
        const relativeKey = 'd/2026/07/28/p/folder id/photo #1.jpg';
        fake.put('source', `source-root/${relativeKey}`, { body: 'photo', acl: 'public-read' });

        await run(fake, '2026-07-28T12:00:00.000Z');

        expect(fake.copyRequests).toContainEqual({
            bucket: 'replica',
            key: `replica-root/${relativeKey}`,
            copySource: 'source/source-root/d/2026/07/28/p/folder%20id/photo%20%231.jpg',
            acl: 'public-read',
        });
    });

    test.each([
        {
            name: 'the replica uses another storage provider',
            sourceSize: 5,
            syncConfig: {
                ...config,
                replica: { ...config.replica, endpoint: 'other-storage.example.com' },
            },
        },
        {
            name: 'the source is larger than the server-side copy limit',
            sourceSize: 5 * 1024 * 1024 * 1024 + 1,
            syncConfig: config,
        },
    ])('streams the file contents when $name', async ({ sourceSize, syncConfig }) => {
        const fake = new FakeS3();
        const relativeKey = 'd/2026/07/28/users/user/file/document.pdf';
        const sourceKey = `source-root/${relativeKey}`;
        fake.put('source', sourceKey, {
            body: 'pdf-data',
            size: sourceSize,
            acl: 'private',
            contentType: 'application/pdf',
            contentDisposition: 'attachment; filename="document.pdf"',
            cacheControl: 'private, max-age=60',
        });

        await run(fake, '2026-07-28T12:00:00.000Z', syncConfig);

        expect(fake.copyRequests).toHaveLength(0);
        expect(fake.getAttempts.get(`source/${sourceKey}`)).toBe(1);
        expect(fake.get('replica', `replica-root/${relativeKey}`)).toMatchObject({
            body: 'pdf-data',
            acl: 'private',
            contentType: 'application/pdf',
            contentDisposition: 'attachment; filename="document.pdf"',
            cacheControl: 'private, max-age=60',
        });
    });

    test('checks older days incrementally using the persisted cursor', async () => {
        const fake = new FakeS3();
        const firstKey = 'd/2026/07/01/p/first/file.jpg';
        const secondKey = 'd/2026/07/02/p/second/file.jpg';
        fake.put('source', `source-root/${firstKey}`, { body: 'first', acl: 'public-read' });
        fake.put('source', `source-root/${secondKey}`, { body: 'second', acl: 'public-read' });

        await run(fake, '2026-07-28T12:00:00.000Z');
        expect(fake.get('replica', `replica-root/${firstKey}`)).toBeDefined();
        expect(fake.get('replica', `replica-root/${secondKey}`)).toBeUndefined();

        await run(fake, '2026-07-28T13:00:00.000Z');
        expect(fake.get('replica', `replica-root/${secondKey}`)).toBeDefined();
    });

    test('tracks and eventually deletes legacy files that disappear after the initial sweep', async () => {
        const fake = new FakeS3();
        const relativeKey = 'p/legacy/photo.jpg';
        fake.put('source', `source-root/${relativeKey}`, { body: 'legacy', acl: 'public-read' });
        await run(fake, '2026-07-28T12:00:00.000Z');
        expect(fake.get('replica', `replica-root/${relativeKey}`)).toBeDefined();

        fake.remove('source', `source-root/${relativeKey}`);
        await run(fake, '2026-08-04T12:00:00.000Z');
        expect(readState(fake, 'replica-root/_sync/legacy.json').missingFiles[relativeKey]).toBeDefined();

        await run(fake, '2026-11-04T12:00:00.000Z');
        expect(fake.get('replica', `replica-root/${relativeKey}`)).toBeUndefined();
    });

    test.each([
        {
            name: 'a source prefix without a trailing slash',
            invalidConfig: {
                ...config,
                source: { ...config.source, prefix: 'invalid' },
            },
        },
        {
            name: 'identical source and replica locations',
            invalidConfig: {
                ...config,
                replica: { ...config.source },
            },
        },
    ])('rejects $name before sending storage commands', async ({ invalidConfig }) => {
        const fake = new FakeS3();

        await expect(run(fake, '2026-07-28T12:00:00.000Z', invalidConfig)).rejects.toThrow();
        expect(fake.events).toHaveLength(0);
    });
});

async function run(fake: FakeS3, date: string, syncConfig: FileSyncConfig = config) {
    await syncFiles(new Date(date), {
        config: syncConfig,
        sourceClient: sender(fake),
        replicaClient: sender(fake),
    });
}

function readState(fake: FakeS3, key: string) {
    return JSON.parse(fake.get('replica', key)!.body);
}

function dayState(options: {
    day: string;
    missingFiles: Record<string, { firstMissingAt: string; size: number }>;
}) {
    return {
        day: options.day,
        lastVerifiedAt: '2026-01-01T00:00:00.000Z',
        objectCount: Object.keys(options.missingFiles).length,
        missingFiles: options.missingFiles,
    };
}

async function bodyToString(body: unknown): Promise<string> {
    if (typeof body === 'string') {
        return body;
    }
    if (body instanceof Uint8Array) {
        return Buffer.from(body).toString();
    }
    if (body && typeof (body as AsyncIterable<unknown>)[Symbol.asyncIterator] === 'function') {
        const chunks: Buffer[] = [];
        for await (const chunk of body as AsyncIterable<string | Uint8Array>) {
            chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk));
        }
        return Buffer.concat(chunks).toString();
    }
    if (body === undefined) {
        return '';
    }
    throw new Error(`Unsupported fake request body type: ${typeof body}`);
}
