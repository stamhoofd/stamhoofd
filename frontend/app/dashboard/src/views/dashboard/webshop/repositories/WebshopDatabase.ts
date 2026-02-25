import { SimpleError } from '@simonbackx/simple-errors';
import { Toast } from '@stamhoofd/components';
import { Version } from '@stamhoofd/structures';
import { OrdersStore } from './WebshopOrdersRepo';
import { WebshopSettingsStore } from './WebshopSettingsStore';
import { WebshopTicketPatchesStore, WebshopTicketsStore } from './WebshopTicketsRepo';

type ObjectStoreInitFunction = (options: { oldVersion: number; database: IDBDatabase; transaction: IDBTransaction | null }) => void;

/**
 * Offline database for storing webshop data (separate database for each webshop).
 */
export class WebshopDatabase {
    readonly id: string;

    private getPromise: Promise<IDBDatabase> | null = null;
    private _database: IDBDatabase | null = null;

    constructor({ webshopId }: { webshopId: string }) {
        this.id = 'webshop-' + webshopId;
    }

    /**
     * Whether the database is supported by the browser.
     * @returns true if the database is supported
     */
    async isSupported(): Promise<boolean> {
        try {
            await this.get();
            return true;
        }
        catch {
            return false;
        }
    }

    /**
     * Get the indexed database.
     */
    async get(): Promise<IDBDatabase> {
        if (this._database) {
            return this._database;
        }

        if (this.getPromise) {
            return this.getPromise;
        }

        // Open a connection with our database
        this.getPromise = new Promise<IDBDatabase>((resolve, reject) => {
            const version = Version;
            let resolved = false;

            const DBOpenRequest = window.indexedDB.open(this.id, version);

            DBOpenRequest.onsuccess = () => {
                this._database = DBOpenRequest.result;

                if (resolved) {
                    return;
                }
                resolved = true;
                resolve(DBOpenRequest.result);
            };

            DBOpenRequest.onblocked = function (e) {
                console.log('DB open blocked', e);
                new Toast($t(`0b6274d7-7a42-4ab3-bc65-5a76c23d07ff`), 'error red').setHide(15 * 1000).show();
            };

            DBOpenRequest.onerror = (event) => {
                console.error(event);

                if (resolved) {
                    return;
                }

                // Try to delete this database if something goes wrong
                this.delete();

                resolved = true;
                reject(new SimpleError({
                    code: 'not_supported',
                    message: $t('5f963722-4ad9-4d5e-91cc-75eac8218349'),
                }));
            };

            DBOpenRequest.onupgradeneeded = (event: IDBVersionChangeEvent) => {
                const database: IDBDatabase = DBOpenRequest.result;

                console.info('Database upgrade', event.oldVersion, event.newVersion);

                this.initStores({ database, transaction: DBOpenRequest.transaction, event });
            };

            // Timeout
            // Sometimes a browser hangs when trying to open a database. We cannot wait forever...
            setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    // Abort
                    reject(new SimpleError({
                        code: 'not_supported',
                        message: $t('4f7e64c6-4607-446d-9a84-8ebcb7206241'),
                    }));
                }
            }, 2000);
        });

        return this.getPromise.then((database) => {
            this.getPromise = null;
            return database;
        });
    }

    async getItemFromStore({ storeName, id }: { storeName: string; id: string }) {
        const db = await this.get();

        return new Promise<any | undefined>((resolve, reject) => {
            const transaction = db.transaction([storeName], 'readonly');

            transaction.onerror = (event) => {
                // Don't forget to handle errors!
                reject(event);
            };

            // Do the actual saving
            const objectStore = transaction.objectStore(storeName);

            const request = objectStore.get(id);

            request.onsuccess = () => {
                const rawResult = request.result;

                if (rawResult) {
                    resolve(rawResult);
                    return;
                }

                resolve(undefined);
            };
        });
    }

    /**
     * Delete the database.
     */
    delete() {
        window.indexedDB.deleteDatabase(this.id);
    }

    /**
     * Init all the stores in the database.
     */
    private initStores({ database, transaction, event }: { database: IDBDatabase; transaction: IDBTransaction | null; event: IDBVersionChangeEvent }) {
        const storeInitializers: ObjectStoreInitFunction[] = [OrdersStore._init, WebshopTicketsStore._init, WebshopTicketPatchesStore._init, WebshopSettingsStore._init];

        for (const initStore of storeInitializers) {
            initStore({ oldVersion: event.oldVersion, database, transaction });
        }
    }
}
