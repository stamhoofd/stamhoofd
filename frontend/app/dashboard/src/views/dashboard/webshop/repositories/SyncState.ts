import type { WebshopSettingsStore } from './WebshopSettingsStore';

/**
 * How recent an updatedAt must be for a sync to treat its second as still open.
 *
 * updatedAt is stored with a one-second resolution, so multiple items can share the exact same second.
 * When the last stored item was updated within this margin of now, the cursor starts one second before
 * its updatedAt, so a sibling item saved in that same second (which the query might not have seen yet)
 * is still fetched by the next sync. Once an item is older than this margin its second can no longer
 * receive writes. The margin must exceed any client/server clock skew and write-visibility lag.
 */
const WATERMARK_SAFETY_MARGIN_MS = 60 * 60 * 1000;

/**
 * Syncs fetch the items with updatedAt > cursor.updatedAt.
 * itemUpdatedAt is the updatedAt of the last stored item, missing in cursors stored by older versions.
 */
export type SyncCursor = { updatedAt: Date; itemUpdatedAt?: Date };

type SyncStateKeys = {
    cursor: 'lastFetchedOrder' | 'lastFetchedTicket';
    completed: 'ordersSyncCompleted' | 'ticketsSyncCompleted';
    lastSyncedAt: 'ordersLastSyncedAt' | 'ticketsLastSyncedAt';
};

/**
 * What this device stored of the orders or the tickets of a webshop, kept in the settings store.
 */
export class SyncState {
    /**
     * undefined until loaded
     */
    private cursor: SyncCursor | null | undefined = undefined;
    private _hasCompletedSync = false;
    private lastSyncedAt: Date | null = null;

    /**
     * The deletionCount of the database when this state was loaded from it
     */
    private loadedDeletionCount: number | null = null;

    constructor(private readonly settingsStore: WebshopSettingsStore, private readonly keys: SyncStateKeys) {}

    get syncCursor(): SyncCursor | null {
        return this.cursor ?? null;
    }

    get hasCompletedSync() {
        return this._hasCompletedSync;
    }

    /**
     * When the last completed sync ended. Devices that completed a sync with an older version only have its cursor.
     */
    get lastUpdated(): Date | null {
        return this.lastSyncedAt ?? (this._hasCompletedSync ? this.cursor?.updatedAt ?? null : null);
    }

    reset() {
        this.cursor = undefined;
        this._hasCompletedSync = false;
        this.lastSyncedAt = null;
        this.loadedDeletionCount = null;
    }

    /**
     * Loads the state for a sync. The returned check throws once the database is deleted after this call: the sync has
     * to stop then, because the new database does not contain the items it stored before.
     */
    async startSync(): Promise<() => void> {
        const deletionCount = this.settingsStore.database.deletionCount;
        await this.load();
        return () => {
            if (this.settingsStore.database.deletionCount !== deletionCount) {
                throw new Error('The offline database was deleted during the sync');
            }
        };
    }

    async load() {
        const deletionCount = this.settingsStore.database.deletionCount;
        if (this.cursor !== undefined && this.loadedDeletionCount === deletionCount) {
            return;
        }

        this.reset();
        this.loadedDeletionCount = deletionCount;

        try {
            this.cursor = await this.settingsStore.get<SyncCursor>(this.keys.cursor) ?? null;

            const completed = await this.settingsStore.get<boolean>(this.keys.completed);
            if (completed === undefined) {
                // Older versions only stored the cursor once a sync completed. Stored, because an interrupted sync
                // also leaves a cursor behind.
                this._hasCompletedSync = this.cursor !== null;
                await this.settingsStore.set(this.keys.completed, this._hasCompletedSync);
            } else {
                this._hasCompletedSync = completed;
            }

            this.lastSyncedAt = await this.settingsStore.get<Date>(this.keys.lastSyncedAt) ?? null;
        } catch (e) {
            console.error(e);
            // Probably no database support. Ignore it and load everything.
            this.cursor = null;
        }
    }

    /**
     * Move the cursor after an item that is stored together with every item before it.
     * It starts one second early while more pages can follow, because they can contain items of the same second.
     */
    async setCursor(lastStoredUpdatedAt: Date, { isComplete }: { isComplete: boolean }) {
        const isSecondSealed = isComplete && lastStoredUpdatedAt.getTime() <= Date.now() - WATERMARK_SAFETY_MARGIN_MS;
        this.cursor = {
            updatedAt: isSecondSealed ? new Date(lastStoredUpdatedAt) : new Date(lastStoredUpdatedAt.getTime() - 1_000),
            itemUpdatedAt: new Date(lastStoredUpdatedAt),
        };
        await this.settingsStore.set(this.keys.cursor, this.cursor);
    }

    async setCompleted() {
        this._hasCompletedSync = true;
        this.lastSyncedAt = new Date();
        await this.settingsStore.set(this.keys.completed, true);
        await this.settingsStore.set(this.keys.lastSyncedAt, this.lastSyncedAt);
    }

    async clear() {
        this.cursor = null;
        this._hasCompletedSync = false;
        this.lastSyncedAt = null;
        await this.settingsStore.set(this.keys.cursor, null);
        await this.settingsStore.set(this.keys.completed, false);
        await this.settingsStore.set(this.keys.lastSyncedAt, null);
    }
}
