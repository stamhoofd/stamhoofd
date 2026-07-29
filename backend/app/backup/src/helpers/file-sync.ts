import {
    CopyObjectCommand,
    DeleteObjectCommand,
    GetObjectAclCommand,
    GetObjectCommand,
    ListObjectsV2Command,
    PutObjectCommand,
    type ObjectCannedACL,
    type S3Client,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { QueueHandler } from '@stamhoofd/queues';
import { buildDayPrefix, isLegacyKey } from '@stamhoofd/object-storage';
import type { ObjectStorageConfig } from '@stamhoofd/types/Environment';
import type { Readable } from 'node:stream';
import { getS3Client } from './backup.js';

/**
 * Replicates the files bucket without immediately mirroring deletions.
 *
 * Objects are matched by the part of their key after the configured source/replica folder.
 * This allows both buckets to use different root folders. Progress and missing-file records
 * are stored as JSON under `_sync/` in the replica bucket.
 *
 * Every run checks today's and yesterday's files, plus enough older day folders to check all
 * stored days within the configured interval. It also periodically checks files created before
 * day folders were introduced. A file missing from the source is recorded, not deleted. It can
 * only be deleted from the replica after it has remained missing for 90 days.
 *
 * This ordering is intentional: losing state or detecting a mass deletion can retain too much,
 * but must never cause the replica to delete too much.
 */
const DAY_MS = 24 * 60 * 60 * 1000;
const MISSING_FILE_RETENTION_MS = 90 * DAY_MS;
const DEFAULT_FULL_REVERIFY_DAYS = 7;
const DEFAULT_MAX_NEW_MISSING_FILES = 1000;
const COPY_CONCURRENCY = 15;
const COPY_OBJECT_LIMIT = 5 * 1024 * 1024 * 1024;

export type S3Sender = Pick<S3Client, 'send'>;
type StoredObject = { key: string; size: number };
type StoredObjectWithRelativeKey = StoredObject & { relativeKey: string };
type MissingFileRecord = { firstMissingAt: string; size: number };
type MissingFilesState = { missingFiles: Record<string, MissingFileRecord> };
type VerifiedStateFile = {
    key: string;
    relativePrefix: string;
    legacyOnly: boolean;
};

export type DaySyncState = {
    day: string;
    lastVerifiedAt: string;
    objectCount: number;
    missingFiles: Record<string, MissingFileRecord>;
};

type SyncScheduleState = {
    nextDayToVerify?: string;
    legacyLastVerifiedAt?: string;
    knownDays: string[];
    knownDaysRefreshedAt?: string;
};

type LegacySyncState = {
    completedAt?: string;
    continuationToken?: string;
    lastVerifiedAt?: string;
    objectCount: number;
    missingFiles: Record<string, MissingFileRecord>;
};

type RunContext = {
    now: Date;
    sourceClient: S3Sender;
    replicaClient: S3Sender;
    source: ObjectStorageConfig;
    replica: ObjectStorageConfig;
    pendingCopies: number;
    newMissingFileCount: number;
    missingFileCount: number;
    massDeletionDetected: boolean;
    verifiedStateFiles: VerifiedStateFile[];
};

export type FileSyncHealth = {
    lastRunAt: Date | null;
    lastFullReverifyAt: Date | null;
    pendingCopies: number;
    missingFileCount: number;
    error: string | null;
};

export type FileSyncConfig = NonNullable<import('@stamhoofd/types/Environment').BackupEnvironment['fileSync']>;

const health: FileSyncHealth = {
    lastRunAt: null,
    lastFullReverifyAt: null,
    pendingCopies: 0,
    missingFileCount: 0,
    error: null,
};

export function getFileSyncHealth(): FileSyncHealth {
    return { ...health };
}

export async function scheduleFileSync(): Promise<void> {
    if (!STAMHOOFD.fileSync) {
        return;
    }

    // Keep file replication independent from the database-backup queue, while ensuring that
    // manual and cron-triggered runs never overlap.
    await QueueHandler.schedule('file-sync', async () => {
        await syncFiles();
    });
}

/**
 * Coordinates one sync run. The optional clients/config make the same flow testable with fake S3.
 */
export async function syncFiles(now = new Date(), overrides?: {
    config: FileSyncConfig;
    sourceClient: S3Sender;
    replicaClient: S3Sender;
}): Promise<void> {
    const config = overrides?.config ?? STAMHOOFD.fileSync;
    if (!config) {
        return;
    }

    try {
        validateConfig(config.source, config.replica);
        const context: RunContext = {
            now,
            sourceClient: overrides?.sourceClient ?? getS3Client(config.source),
            replicaClient: overrides?.replicaClient ?? getS3Client(config.replica),
            source: config.source,
            replica: config.replica,
            pendingCopies: 0,
            newMissingFileCount: 0,
            missingFileCount: 0,
            massDeletionDetected: false,
            verifiedStateFiles: [],
        };
        const fullReverifyDays = config.fullReverifyDays ?? DEFAULT_FULL_REVERIFY_DAYS;
        const cursorKey = getReplicaObjectKey(config.replica, '_sync/cursor.json');
        const cursor = await readJson<SyncScheduleState>({
            client: context.replicaClient,
            bucket: config.replica.bucket,
            key: cursorKey,
            isValid: isSyncScheduleState,
        }) ?? { knownDays: [] };
        const refreshBefore = now.getTime() - fullReverifyDays * DAY_MS;

        // Discover actual prefixes instead of generating every calendar day. Previously known
        // days are retained because a day may have vanished entirely from the source.
        if (!cursor.knownDaysRefreshedAt || new Date(cursor.knownDaysRefreshedAt).getTime() < refreshBefore) {
            const discoveredDays = await discoverDays({
                client: context.sourceClient,
                config: config.source,
                startDate: config.startDate,
            });
            cursor.knownDays = [...new Set([...cursor.knownDays, ...discoveredDays])].sort();
            cursor.knownDaysRefreshedAt = now.toISOString();
        }

        // Always check today and yesterday to catch recent uploads and clock differences.
        // Spread older days across hourly runs so all stored days are checked regularly.
        const today = canonicalDay(now);
        const yesterday = canonicalDay(new Date(now.getTime() - DAY_MS));
        const olderDays = cursor.knownDays.filter(day => day !== today && day !== yesterday);
        const numberToVerify = Math.max(1, Math.ceil(olderDays.length / (fullReverifyDays * 24)));
        const rollingDays = takeRollingDays({
            days: olderDays,
            nextDay: cursor.nextDayToVerify,
            count: numberToVerify,
        });
        const days = [...new Set([today, yesterday, ...rollingDays.days])];
        cursor.nextDayToVerify = rollingDays.nextDay;
        if (rollingDays.wrapped) {
            health.lastFullReverifyAt = now;
        }

        for (const day of days) {
            await synchronizeDayPrefix({
                context,
                day,
                maxNewMissingFiles: config.maxNewMissingFilesPerRun ?? DEFAULT_MAX_NEW_MISSING_FILES,
            });
        }

        // Legacy objects cannot be moved into day prefixes because their signed keys are immutable.
        const legacyDue = !cursor.legacyLastVerifiedAt
            || now.getTime() - new Date(cursor.legacyLastVerifiedAt).getTime() >= fullReverifyDays * DAY_MS;
        if (legacyDue) {
            const completed = await copyAndCheckLegacyFiles(context, config.maxNewMissingFilesPerRun ?? DEFAULT_MAX_NEW_MISSING_FILES);
            if (completed) {
                cursor.legacyLastVerifiedAt = now.toISOString();
            }
        }

        // First finish checking every selected folder. Only then delete files that have been
        // missing for 90 days. If this run detects mass deletion, none of them are deleted.
        if (!context.massDeletionDetected) {
            await deleteExpiredMissingFiles(context);
        }
        else {
            console.error(`File sync detected ${context.newMissingFileCount} newly missing files; expired files were not deleted`);
        }

        await writeJson({
            client: context.replicaClient,
            bucket: config.replica.bucket,
            key: cursorKey,
            value: cursor,
        });
        health.lastRunAt = now;
        health.pendingCopies = context.pendingCopies;
        health.missingFileCount = context.missingFileCount;
        health.error = context.massDeletionDetected ? 'Mass deletion detected' : null;
    }
    catch (error) {
        health.error = error instanceof Error ? error.message : String(error);
        throw error;
    }
}

async function* iterateObjects(options: {
    client: S3Sender;
    bucket: string;
    prefix: string;
    root: string;
    legacyOnly?: boolean;
}): AsyncGenerator<StoredObjectWithRelativeKey> {
    const { client, bucket, prefix, root, legacyOnly = false } = options;
    let continuationToken: string | undefined;
    let previousKey: string | undefined;

    do {
        const response = await client.send(new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: prefix,
            ContinuationToken: continuationToken,
        })) as {
            Contents?: { Key?: string; Size?: number }[];
            NextContinuationToken?: string;
        };
        for (const object of response.Contents ?? []) {
            if (!object.Key) {
                continue;
            }
            if (previousKey && object.Key <= previousKey) {
                throw new Error(`Object storage returned duplicate or unsorted key: ${object.Key}`);
            }
            previousKey = object.Key;

            const relativeKey = object.Key.slice(root.length);
            if (relativeKey.startsWith('_sync/') || (legacyOnly && !isLegacyKey(object.Key, root))) {
                continue;
            }
            yield {
                key: object.Key,
                relativeKey,
                size: object.Size ?? 0,
            };
        }
        continuationToken = response.NextContinuationToken;
    } while (continuationToken);
}

export async function discoverDays(options: {
    client: S3Sender;
    config: ObjectStorageConfig;
    startDate?: string;
}): Promise<string[]> {
    const { client, config, startDate } = options;
    const root = storageRoot(config);
    const years = await listCommonPrefixes({ client, bucket: config.bucket, prefix: `${root}d/` });
    const days: string[] = [];

    // Delimited listings keep every response bounded: years -> months -> populated days.
    for (const yearPrefix of years) {
        for (const monthPrefix of await listCommonPrefixes({ client, bucket: config.bucket, prefix: yearPrefix })) {
            for (const dayPrefix of await listCommonPrefixes({ client, bucket: config.bucket, prefix: monthPrefix })) {
                const relative = dayPrefix.slice(`${root}d/`.length).replace(/\/$/, '');
                const day = relative.replaceAll('/', '-');
                if (/^\d{4}-\d{2}-\d{2}$/.test(day) && (!startDate || day >= startDate)) {
                    days.push(day);
                }
            }
        }
    }

    return [...new Set(days)].sort();
}

async function synchronizeDayPrefix(options: {
    context: RunContext;
    day: string;
    maxNewMissingFiles: number;
}): Promise<void> {
    const { context, day, maxNewMissingFiles } = options;
    const relativePrefix = buildDayPrefix('', new Date(`${day}T00:00:00.000Z`));
    const stateKey = getReplicaObjectKey(context.replica, `_sync/days/${day.replaceAll('-', '/')}.json`);
    const storedState = await readJson<DaySyncState>({
        client: context.replicaClient,
        bucket: context.replica.bucket,
        key: stateKey,
        isValid: value => isDaySyncState(value)
            && value.day === day
            && Object.keys(value.missingFiles).every(key => key.startsWith(relativePrefix)),
    });
    const state: DaySyncState = storedState ?? {
        day,
        lastVerifiedAt: context.now.toISOString(),
        objectCount: 0,
        missingFiles: {},
    };

    // If the state file is missing or broken, record what is currently missing but do not delete
    // anything. Without trustworthy history we cannot know whether 90 days have passed.
    await copySourceFilesAndTrackMissingFiles({
        context,
        relativePrefix,
        stateKey,
        state,
        maxNewMissingFiles,
        allowDeletingExpiredMissingFiles: storedState !== null,
    });
    state.day = day;
    state.lastVerifiedAt = context.now.toISOString();
    await writeJson({
        client: context.replicaClient,
        bucket: context.replica.bucket,
        key: stateKey,
        value: state,
    });
}

async function copyAndCheckLegacyFiles(context: RunContext, maxNewMissingFiles: number): Promise<boolean> {
    const stateKey = getReplicaObjectKey(context.replica, '_sync/legacy.json');
    const storedState = await readJson<LegacySyncState>({
        client: context.replicaClient,
        bucket: context.replica.bucket,
        key: stateKey,
        isValid: value => isLegacySyncState(value)
            && Object.keys(value.missingFiles).every(key => isLegacyKey(storageRoot(context.replica) + key, storageRoot(context.replica))),
    });
    const state: LegacySyncState = storedState ?? { objectCount: 0, missingFiles: {} };

    // The first sweep checkpoints after every listing page. If a copy fails, the next run resumes
    // at the last persisted continuation token and verifies already-copied objects by size.
    if (!state.completedAt) {
        while (!state.completedAt) {
            await copyLegacyPage(context, state);
            await writeJson({
                client: context.replicaClient,
                bucket: context.replica.bucket,
                key: stateKey,
                value: state,
            });
        }
    }

    await copySourceFilesAndTrackMissingFiles({
        context,
        relativePrefix: '',
        stateKey,
        state,
        maxNewMissingFiles,
        allowDeletingExpiredMissingFiles: storedState !== null,
        legacyOnly: true,
    });
    state.lastVerifiedAt = context.now.toISOString();
    await writeJson({
        client: context.replicaClient,
        bucket: context.replica.bucket,
        key: stateKey,
        value: state,
    });
    return true;
}

async function copyLegacyPage(context: RunContext, state: LegacySyncState): Promise<boolean> {
    const sourceRoot = storageRoot(context.source);
    const response = await context.sourceClient.send(new ListObjectsV2Command({
        Bucket: context.source.bucket,
        Prefix: sourceRoot,
        ContinuationToken: state.continuationToken,
    })) as {
        Contents?: { Key?: string; Size?: number }[];
        NextContinuationToken?: string;
    };
    const sourceObjects = (response.Contents ?? [])
        .filter(object => object.Key && isLegacyKey(object.Key, sourceRoot))
        .map(object => ({
            relativeKey: object.Key!.slice(sourceRoot.length),
            source: { key: object.Key!, size: object.Size ?? 0 },
        }));

    await mapConcurrent({
        items: sourceObjects,
        concurrency: COPY_CONCURRENCY,
        handler: async ({ relativeKey, source }) => {
            const replicaObject = await findObject({
                client: context.replicaClient,
                bucket: context.replica.bucket,
                key: getReplicaObjectKey(context.replica, relativeKey),
            });
            if (!replicaObject || replicaObject.size !== source.size) {
                await copyObject({ context, source, relativeKey });
            }
        },
    });

    state.objectCount += sourceObjects.length;
    state.continuationToken = response.NextContinuationToken;
    if (!response.NextContinuationToken) {
        state.completedAt = context.now.toISOString();
        delete state.continuationToken;
        return true;
    }
    return false;
}

/**
 * Checks one source folder against the corresponding folder in the replica bucket.
 *
 * It copies files that are missing from the replica, and copies them again when their sizes
 * differ. If a file exists only in the replica, it records when that file was first noticed
 * missing from the source. If the file later returns to the source, that missing-file record
 * is removed.
 *
 * Nothing is deleted by this function. After every selected folder has been checked, a separate
 * pass reloads these state files and deletes entries that have remained missing for 90 days.
 */
async function copySourceFilesAndTrackMissingFiles(options: {
    context: RunContext;
    relativePrefix: string;
    stateKey: string;
    state: Pick<DaySyncState, 'objectCount' | 'missingFiles'>;
    maxNewMissingFiles: number;
    allowDeletingExpiredMissingFiles: boolean;
    legacyOnly?: boolean;
}): Promise<void> {
    const {
        context,
        relativePrefix,
        stateKey,
        state,
        maxNewMissingFiles,
        allowDeletingExpiredMissingFiles,
        legacyOnly = false,
    } = options;
    const sourceRoot = storageRoot(context.source);
    const replicaRoot = storageRoot(context.replica);
    const sourceObjects = iterateObjects({
        client: context.sourceClient,
        bucket: context.source.bucket,
        prefix: sourceRoot + relativePrefix,
        root: sourceRoot,
        legacyOnly,
    });
    const replicaObjects = iterateObjects({
        client: context.replicaClient,
        bucket: context.replica.bucket,
        prefix: replicaRoot + relativePrefix,
        root: replicaRoot,
        legacyOnly,
    });

    const copyTasks = new BoundedTaskRunner(COPY_CONCURRENCY);
    let source = await nextObject(sourceObjects);
    let replica = await nextObject(replicaObjects);
    let sourceCount = 0;
    let replicaCount = 0;
    let newForPrefix = 0;

    try {
        while (source || replica) {
            if (source && (!replica || source.relativeKey < replica.relativeKey)) {
                sourceCount++;
                delete state.missingFiles[source.relativeKey];
                await scheduleCopy({ context, tasks: copyTasks, source });
                source = await nextObject(sourceObjects);
                continue;
            }

            if (replica && (!source || replica.relativeKey < source.relativeKey)) {
                replicaCount++;
                if (!state.missingFiles[replica.relativeKey]) {
                    state.missingFiles[replica.relativeKey] = {
                        firstMissingAt: context.now.toISOString(),
                        size: replica.size,
                    };
                    context.newMissingFileCount++;
                    newForPrefix++;
                }
                replica = await nextObject(replicaObjects);
                continue;
            }

            if (!source || !replica) {
                throw new Error('Unexpected empty object while comparing source and replica');
            }

            sourceCount++;
            replicaCount++;
            delete state.missingFiles[source.relativeKey];
            if (source.size !== replica.size) {
                console.warn(`File sync size mismatch for ${source.relativeKey}; copying source again`);
                await scheduleCopy({ context, tasks: copyTasks, source });
            }
            source = await nextObject(sourceObjects);
            replica = await nextObject(replicaObjects);
        }
    }
    finally {
        await copyTasks.waitForCompletion();
    }

    state.objectCount = sourceCount;
    context.missingFileCount += Object.keys(state.missingFiles).length;
    const baseline = Math.max(sourceCount + newForPrefix, replicaCount);
    if (context.newMissingFileCount > maxNewMissingFiles || (baseline > 0 && newForPrefix / baseline > 0.2)) {
        context.massDeletionDetected = true;
    }
    if (allowDeletingExpiredMissingFiles) {
        context.verifiedStateFiles.push({
            key: stateKey,
            relativePrefix,
            legacyOnly,
        });
    }
}

async function deleteExpiredMissingFiles(context: RunContext): Promise<void> {
    // This is only reached after checking every selected folder without detecting mass deletion.
    // Remove each missing-file record after deleting the corresponding file from the replica.
    for (const stateFile of context.verifiedStateFiles) {
        const state = await readJson<MissingFilesState>({
            client: context.replicaClient,
            bucket: context.replica.bucket,
            key: stateFile.key,
            isValid: value => hasValidMissingFiles(value)
                && Object.keys(value.missingFiles).every((relativeKey) => {
                    if (stateFile.legacyOnly) {
                        return isLegacyKey(storageRoot(context.replica) + relativeKey, storageRoot(context.replica));
                    }
                    return relativeKey.startsWith(stateFile.relativePrefix);
                }),
        });
        if (!state) {
            continue;
        }

        let changed = false;
        for (const [relativeKey, missingFile] of Object.entries(state.missingFiles)) {
            if (context.now.getTime() - new Date(missingFile.firstMissingAt).getTime() < MISSING_FILE_RETENTION_MS) {
                continue;
            }
            const sourceObject = await findObject({
                client: context.sourceClient,
                bucket: context.source.bucket,
                key: storageRoot(context.source) + relativeKey,
            });
            if (sourceObject) {
                delete state.missingFiles[relativeKey];
                context.missingFileCount--;
                changed = true;
                continue;
            }
            await context.replicaClient.send(new DeleteObjectCommand({
                Bucket: context.replica.bucket,
                Key: getReplicaObjectKey(context.replica, relativeKey),
            }));
            delete state.missingFiles[relativeKey];
            context.missingFileCount--;
            changed = true;
        }

        if (changed) {
            await writeJson({
                client: context.replicaClient,
                bucket: context.replica.bucket,
                key: stateFile.key,
                value: state,
            });
        }
    }
}

async function copyObject(options: {
    context: RunContext;
    source: StoredObject;
    relativeKey: string;
}): Promise<void> {
    const { context, source, relativeKey } = options;
    // ACLs cannot be inferred from the key: source images deliberately store a private original
    // below the otherwise-public p/ prefix.
    const acl = await retry(async () => getCannedAcl({
        client: context.sourceClient,
        bucket: context.source.bucket,
        key: source.key,
    }));
    const destinationKey = getReplicaObjectKey(context.replica, relativeKey);
    const sameEndpoint = normalizeEndpoint(context.source.endpoint) === normalizeEndpoint(context.replica.endpoint);

    // Prefer provider-side copy. Cross-provider and >5 GB objects are streamed via multipart
    // upload while preserving the HTTP metadata needed when the replica is restored.
    if (sameEndpoint && source.size <= COPY_OBJECT_LIMIT) {
        await retry(async () => {
            await context.replicaClient.send(new CopyObjectCommand({
                Bucket: context.replica.bucket,
                Key: destinationKey,
                CopySource: encodeCopySource(context.source.bucket, source.key),
                MetadataDirective: 'COPY',
                ACL: acl,
            }));
        });
        return;
    }

    await retry(async () => {
        const response = await context.sourceClient.send(new GetObjectCommand({
            Bucket: context.source.bucket,
            Key: source.key,
        })) as {
            Body?: Readable;
            ContentType?: string;
            ContentDisposition?: string;
            CacheControl?: string;
        };
        if (!response.Body) {
            throw new Error(`Source object ${source.key} returned an empty body`);
        }
        const upload = new Upload({
            client: context.replicaClient as S3Client,
            params: {
                Bucket: context.replica.bucket,
                Key: destinationKey,
                Body: response.Body,
                ContentType: response.ContentType,
                ContentDisposition: response.ContentDisposition,
                CacheControl: response.CacheControl,
                ACL: acl,
            },
        });
        await upload.done();
    });
}

async function scheduleCopy(options: {
    context: RunContext;
    tasks: BoundedTaskRunner;
    source: StoredObjectWithRelativeKey;
}): Promise<void> {
    const { context, tasks, source } = options;
    context.pendingCopies++;
    health.pendingCopies = context.pendingCopies;
    await tasks.add(async () => {
        try {
            await copyObject({
                context,
                source,
                relativeKey: source.relativeKey,
            });
        }
        finally {
            context.pendingCopies--;
            health.pendingCopies = context.pendingCopies;
        }
    });
}

async function getCannedAcl(options: {
    client: S3Sender;
    bucket: string;
    key: string;
}): Promise<ObjectCannedACL> {
    const { client, bucket, key } = options;
    const acl = await client.send(new GetObjectAclCommand({ Bucket: bucket, Key: key })) as {
        Grants?: { Grantee?: { URI?: string }; Permission?: string }[];
    };
    return acl.Grants?.some(grant =>
        grant.Grantee?.URI === 'http://acs.amazonaws.com/groups/global/AllUsers'
        && grant.Permission === 'READ',
    )
        ? 'public-read'
        : 'private';
}

async function listCommonPrefixes(options: {
    client: S3Sender;
    bucket: string;
    prefix: string;
}): Promise<string[]> {
    const { client, bucket, prefix } = options;
    const prefixes: string[] = [];
    let continuationToken: string | undefined;
    do {
        const response = await client.send(new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: prefix,
            Delimiter: '/',
            ContinuationToken: continuationToken,
        })) as {
            CommonPrefixes?: { Prefix?: string }[];
            NextContinuationToken?: string;
        };
        for (const item of response.CommonPrefixes ?? []) {
            if (item.Prefix) {
                prefixes.push(item.Prefix);
            }
        }
        continuationToken = response.NextContinuationToken;
    } while (continuationToken);
    return prefixes;
}

async function findObject(options: {
    client: S3Sender;
    bucket: string;
    key: string;
}): Promise<StoredObject | null> {
    const { client, bucket, key } = options;
    const response = await client.send(new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: key,
        MaxKeys: 1,
    })) as { Contents?: { Key?: string; Size?: number }[] };
    const object = response.Contents?.find(item => item.Key === key);
    return object?.Key ? { key: object.Key, size: object.Size ?? 0 } : null;
}

async function readJson<T>(options: {
    client: S3Sender;
    bucket: string;
    key: string;
    isValid?: (value: unknown) => boolean;
}): Promise<T | null> {
    const { client, bucket, key, isValid } = options;
    try {
        const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key })) as {
            Body?: { transformToString(): Promise<string> };
        };
        if (!response.Body) {
            return null;
        }
        const value: unknown = JSON.parse(await response.Body.transformToString());
        if (isValid && !isValid(value)) {
            console.error(`Ignoring invalid file sync state at ${key}`);
            return null;
        }
        return value as T;
    }
    catch (error) {
        if (isNotFound(error)) {
            return null;
        }
        if (error instanceof SyntaxError) {
            // Corrupt state is treated like missing state. The current run may record missing
            // files, but it cannot safely delete any files based on untrusted history.
            console.error(`Ignoring unparseable file sync state at ${key}`);
            return null;
        }
        throw error;
    }
}

async function writeJson(options: {
    client: S3Sender;
    bucket: string;
    key: string;
    value: unknown;
}): Promise<void> {
    const { client, bucket, key, value } = options;
    await client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: JSON.stringify(value),
        ContentType: 'application/json',
        ACL: 'private',
    }));
}

function isSyncScheduleState(value: unknown): value is SyncScheduleState {
    if (!isRecord(value) || !Array.isArray(value.knownDays) || !value.knownDays.every(day => typeof day === 'string')) {
        return false;
    }
    return isOptionalString(value.nextDayToVerify)
        && isOptionalString(value.legacyLastVerifiedAt)
        && isOptionalString(value.knownDaysRefreshedAt);
}

function isDaySyncState(value: unknown): value is DaySyncState {
    return isRecord(value)
        && typeof value.day === 'string'
        && typeof value.lastVerifiedAt === 'string'
        && typeof value.objectCount === 'number'
        && hasValidMissingFiles(value);
}

function isLegacySyncState(value: unknown): value is LegacySyncState {
    return isRecord(value)
        && typeof value.objectCount === 'number'
        && isOptionalString(value.completedAt)
        && isOptionalString(value.continuationToken)
        && isOptionalString(value.lastVerifiedAt)
        && hasValidMissingFiles(value);
}

function hasValidMissingFiles(value: unknown): value is MissingFilesState {
    if (!isRecord(value) || !isRecord(value.missingFiles)) {
        return false;
    }
    return Object.values(value.missingFiles).every(missingFile =>
        isRecord(missingFile)
        && typeof missingFile.firstMissingAt === 'string'
        && Number.isFinite(new Date(missingFile.firstMissingAt).getTime())
        && typeof missingFile.size === 'number'
        && Number.isFinite(missingFile.size),
    );
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOptionalString(value: unknown): boolean {
    return value === undefined || typeof value === 'string';
}

function storageRoot(config: ObjectStorageConfig): string {
    return config.prefix ?? '';
}

function getReplicaObjectKey(config: ObjectStorageConfig, relativeKey: string): string {
    return storageRoot(config) + relativeKey;
}

function validateConfig(source: ObjectStorageConfig, replica: ObjectStorageConfig): void {
    for (const config of [source, replica]) {
        if (config.prefix && !config.prefix.endsWith('/')) {
            throw new Error('Object storage file sync prefixes must be empty or end in "/"');
        }
    }
    if (
        normalizeEndpoint(source.endpoint) === normalizeEndpoint(replica.endpoint)
        && source.bucket === replica.bucket
        && storageRoot(source) === storageRoot(replica)
    ) {
        throw new Error('Source and replica object storage locations must be different');
    }
}

function normalizeEndpoint(endpoint: string): string {
    return endpoint.replace(/^https?:\/\//, '').replace(/\/+$/, '').toLowerCase();
}

function encodeCopySource(bucket: string, key: string): string {
    return `${bucket}/${key.split('/').map(encodeURIComponent).join('/')}`;
}

function canonicalDay(date: Date): string {
    return date.toISOString().slice(0, 10);
}

function takeRollingDays(options: {
    days: string[];
    nextDay: string | undefined;
    count: number;
}): {
    days: string[];
    nextDay?: string;
    wrapped: boolean;
} {
    const { days, nextDay, count } = options;
    if (days.length === 0) {
        return { days: [], wrapped: true };
    }
    let index = nextDay ? Math.max(0, days.findIndex(day => day >= nextDay)) : 0;
    const selected: string[] = [];
    let wrapped = false;
    for (let i = 0; i < Math.min(count, days.length); i++) {
        selected.push(days[index]);
        index++;
        if (index >= days.length) {
            index = 0;
            wrapped = true;
        }
    }
    return { days: selected, nextDay: days[index], wrapped };
}

async function mapConcurrent<T>(options: {
    items: T[];
    concurrency: number;
    handler: (item: T) => Promise<void>;
}): Promise<void> {
    const { items, concurrency, handler } = options;
    let nextIndex = 0;
    await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
        while (nextIndex < items.length) {
            const item = items[nextIndex++];
            await handler(item);
        }
    }));
}

async function nextObject(
    objects: AsyncIterator<StoredObjectWithRelativeKey>,
): Promise<StoredObjectWithRelativeKey | null> {
    const next = await objects.next();
    return next.done ? null : next.value;
}

class BoundedTaskRunner {
    private readonly running = new Set<Promise<void>>();
    private firstError: unknown | null = null;

    constructor(private readonly concurrency: number) {}

    async add(task: () => Promise<void>): Promise<void> {
        this.throwFirstError();
        while (this.running.size >= this.concurrency) {
            await Promise.race(this.running);
            this.throwFirstError();
        }

        const runningTask: Promise<void> = task()
            .catch((error) => {
                this.firstError ??= error;
            })
            .finally(() => {
                this.running.delete(runningTask);
            });
        this.running.add(runningTask);
    }

    async waitForCompletion(): Promise<void> {
        await Promise.all(this.running);
        this.throwFirstError();
    }

    private throwFirstError(): void {
        if (this.firstError) {
            if (this.firstError instanceof Error) {
                throw this.firstError;
            }
            throw new Error('Copy task failed with a non-Error value', { cause: this.firstError });
        }
    }
}

async function retry<T>(handler: () => Promise<T>, attempts = 4): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt < attempts; attempt++) {
        try {
            return await handler();
        }
        catch (error) {
            lastError = error;
            if (!isRetryable(error) || attempt === attempts - 1) {
                throw error;
            }
            await new Promise(resolve => setTimeout(resolve, 250 * (2 ** attempt)));
        }
    }
    throw lastError;
}

function isRetryable(error: unknown): boolean {
    const status = (error as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
    return status === 429 || (status !== undefined && status >= 500);
}

function isNotFound(error: unknown): boolean {
    const candidate = error as { name?: string; $metadata?: { httpStatusCode?: number } };
    return candidate?.name === 'NoSuchKey'
        || candidate?.name === 'NotFound'
        || candidate?.$metadata?.httpStatusCode === 404;
}
