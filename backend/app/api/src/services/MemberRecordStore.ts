import { Model } from '@simonbackx/simple-database';
import { Organization, Platform } from '@stamhoofd/models';
import { QueueHandler } from '@stamhoofd/queues';
import { RecordSettings } from '@stamhoofd/structures';

export type RecordCacheEntry = { record: RecordSettings; rootCategoryId: string; organizationId: string | null };

/**
 * Service that caches all available member records in the system.
 * - It verified whether ids are unique system wide
 * - It allows fast retrieving of record settings by id (for permission checking)
 */
export class MemberRecordStore {
    private static cache = new Map<string, RecordCacheEntry>();

    constructor() {

    }

    static init() {
        // Load initial data
        this.loadIfNeeded().catch(console.error);

        // Create listeners to update data as organizations and platform is updated
        this.listen();
    }

    private static listening = false;

    private static listen() {
        // Create listeners to update data as organizations and platform is updated
        if (this.listening) {
            return;
        }

        this.listening = true;
        Model.modelEventBus.addListener(this, async (event) => {
            if (event.type === 'deleted') {
                if (event.model instanceof Platform || event.model instanceof Organization) {
                    // Reload
                    this._didLoadAll = false;
                    this._loadAllPromise = null;
                }
                return;
            }

            if (event.model instanceof Platform) {
                // Delete all records with organizationId = null
                for (const [id, entry] of this.cache) {
                    if (entry.organizationId === null) {
                        this.cache.delete(id);
                    }
                }

                // Readd of this model
                for (const recordCategory of event.model.config.recordsConfiguration.recordCategories) {
                    for (const record of recordCategory.getAllRecords()) {
                        // Add to cache
                        this.cache.set(record.id, {
                            record: record.clone(),
                            organizationId: null,
                            rootCategoryId: recordCategory.id,
                        });
                    }
                }
            }

            if (event.model instanceof Organization) {
                // Delete all records with organizationId = null
                for (const [id, entry] of this.cache) {
                    if (entry.organizationId === event.model.id) {
                        this.cache.delete(id);
                    }
                }

                // Readd of this model
                for (const recordCategory of event.model.meta.recordsConfiguration.recordCategories) {
                    for (const record of recordCategory.getAllRecords()) {
                        // Add to cache
                        this.cache.set(record.id, {
                            record: record.clone(),
                            organizationId: event.model.id,
                            rootCategoryId: recordCategory.id,
                        });
                    }
                }
            }
        });
    }

    static _loadAllPromise: Promise<void> | null = null;
    static _didLoadAll = false;

    static async loadIfNeeded() {
        if (this._didLoadAll) {
            return;
        }

        if (this._loadAllPromise) {
            await this._loadAllPromise;
        }
        else {
            this._loadAllPromise = (async () => {
                try {
                    await this.loadAll();
                }
                catch (e) {
                    // Failed to load
                    this._loadAllPromise = null;
                    throw e;
                }
                this._didLoadAll = true;
                this._loadAllPromise = null;
            })();
            await this._loadAllPromise;
        }
    }

    static async loadAll() {
        this.cache = new Map<string, RecordCacheEntry>();

        // We use a queue here so we can abort this long running task properly
        // + can await it when shutting down the server or tests
        await QueueHandler.schedule('MemberRecordStore.loadAll', async ({ abort }) => {
            this.cache = new Map<string, RecordCacheEntry>();

            const platform = await Platform.getShared();
            for (const recordCategory of platform.config.recordsConfiguration.recordCategories) {
                for (const record of recordCategory.getAllRecords()) {
                    // Add to cache
                    this.cache.set(record.id, {
                        record: record.clone(),
                        organizationId: null,
                        rootCategoryId: recordCategory.id,
                    });
                }
            }
            abort.throwIfAborted();

            for await (const organization of Organization.select().all()) {
                for (const recordCategory of organization.meta.recordsConfiguration.recordCategories) {
                    for (const record of recordCategory.getAllRecords()) {
                        if (this.cache.has(record.id)) {
                            console.error(`Duplicate record id ${record.id} found in organization ${organization.id} for record ${record.name.toString()} (${record.id}) in ${recordCategory.name.toString()}`);
                            continue;
                        }
                        // Add to cache
                        this.cache.set(record.id, {
                            record: record.clone(),
                            organizationId: organization.id,
                            rootCategoryId: recordCategory.id,
                        });
                    }
                }
                abort.throwIfAborted();
            }
        });
    }

    static async getRecord(id: string): Promise<RecordCacheEntry | null> {
        await this.loadIfNeeded();
        return this.cache.get(id) ?? null;
    }
}
