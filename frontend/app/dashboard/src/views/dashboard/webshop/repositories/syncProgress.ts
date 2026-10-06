import type { ObjectFetcher } from '@stamhoofd/components/tables/classes/ObjectFetcher';
import type { StamhoofdFilter } from '@stamhoofd/structures';
import { CountFilteredRequest } from '@stamhoofd/structures';

export type SyncProgress = { count: number; total: number };

/**
 * Matches the items of a sync that are newer than the last stored item, null if nothing is stored yet.
 */
export function getNewItemsFilter(webshopId: string, lastStoredUpdatedAt: Date | null): StamhoofdFilter | null {
    return lastStoredUpdatedAt ? { webshopId, updatedAt: { $gt: lastStoredUpdatedAt } } : null;
}

/**
 * Counts the items of a sync, or returns null if none of them are new to the offline database.
 *
 * @param newItemsFilter matches the items of the sync that are not stored yet, null if none are stored
 */
export async function countSyncItems<T>(fetcher: ObjectFetcher<T>, filter: StamhoofdFilter, newItemsFilter: StamhoofdFilter | null): Promise<number | null> {
    const [all, newItems] = await Promise.all([
        fetcher.fetchCount(new CountFilteredRequest({ filter })),
        newItemsFilter ? fetcher.fetchCount(new CountFilteredRequest({ filter: newItemsFilter })) : null,
    ]);
    return newItems === 0 ? null : all;
}

/**
 * Receives null when a next sync starts, to clear the progress of the previous one
 */
export type ProgressListener = (progress: SyncProgress | null) => void;

type RunningSync = {
    promise: Promise<void>;
    progress: SyncProgress | null;
    listeners: ProgressListener[];
};

/**
 * Runs one sync at a time. A caller that starts a sync while one is running receives the progress of that sync,
 * and then waits for one more sync, because the running one might have started before the changes the caller needs.
 * All callers that arrive during the same sync share that next sync.
 */
export class SharedSync {
    private running: RunningSync | null = null;
    private next: { promise: Promise<void>; listeners: ProgressListener[] } | null = null;

    get isRunning() {
        return this.running !== null;
    }

    /**
     * Resolves once no sync is running, regardless of its result.
     */
    async waitUntilIdle() {
        while (this.running) {
            await this.running.promise.catch(() => {});
        }
    }

    async run(sync: (onProgress: (progress: SyncProgress) => void) => Promise<void>, onProgress?: ProgressListener): Promise<void> {
        const running = this.running;
        if (!running) {
            return this.start(sync, onProgress ? [onProgress] : []);
        }

        if (onProgress) {
            running.listeners.push(onProgress);
            if (running.progress) {
                onProgress(running.progress);
            }
        }

        if (!this.next) {
            const listeners: ProgressListener[] = [];
            this.next = {
                listeners,
                promise: running.promise.catch(() => {}).then(async () => {
                    this.next = null;
                    for (const listener of listeners) {
                        listener(null);
                    }
                    await this.start(sync, listeners);
                }),
            };
        }
        if (onProgress) {
            this.next.listeners.push(onProgress);
        }
        return this.next.promise;
    }

    private async start(sync: (onProgress: (progress: SyncProgress) => void) => Promise<void>, listeners: ProgressListener[]): Promise<void> {
        const running: RunningSync = {
            promise: Promise.resolve(),
            progress: null,
            listeners,
        };
        running.promise = sync((progress) => {
            running.progress = progress;
            for (const listener of running.listeners) {
                listener(progress);
            }
        }).finally(() => {
            if (this.running === running) {
                this.running = null;
            }
        });
        this.running = running;
        return running.promise;
    }
}
