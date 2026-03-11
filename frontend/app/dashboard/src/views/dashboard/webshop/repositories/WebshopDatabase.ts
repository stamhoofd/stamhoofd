import { SimpleError } from '@simonbackx/simple-errors';
import { Toast } from '@stamhoofd/components';
import { Version } from '@stamhoofd/structures';
import { OrderIndexedDBIndex } from '../ordersIndexedDBSorters';

type ObjectStoreInitFunction = (options: { oldVersion: number; database: IDBDatabase; transaction: IDBTransaction | null }) => void;

/**
 * Offline database for storing webshop data (separate database for each webshop).
 */
export class WebshopDatabase {
    readonly databaseName: string;

    private getPromise: Promise<IDBDatabase> | null = null;
    private _database: IDBDatabase | null = null;
    private isDeleting = false;

    constructor({ webshopId }: { webshopId: string }) {
        this.databaseName = 'webshop-' + webshopId;
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

            const DBOpenRequest = window.indexedDB.open(this.databaseName, version);

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
                new Toast($t(`%PW`), 'error red').setHide(15 * 1000).show();
            };

            DBOpenRequest.onerror = (event) => {
                console.error(event);

                if (resolved) {
                    return;
                }

                // Try to delete this database if something goes wrong
                this.delete().catch(console.error);

                resolved = true;
                reject(new SimpleError({
                    code: 'not_supported',
                    message: $t('%PU'),
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
                        message: $t('%PV'),
                    }));
                }
            }, 2000);
        });

        return this.getPromise.then((database) => {
            this.getPromise = null;
            return database;
        });
    }

    async getItemFromStore({ storeName, id, openTransaction }: { storeName: string; id: string; openTransaction?: IDBTransaction }) {
        const db = await this.get();

        return new Promise<any | undefined>((resolve, reject) => {
            const transaction = openTransaction ?? db.transaction([storeName], 'readonly');

            transaction.onerror = (event) => {
                // Don't forget to handle errors!
                if (openTransaction && openTransaction.onerror) {
                    openTransaction.onerror(event);
                }

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

    close() {
        if (this._database) {
            this._database.close();
            this._database = null;
        }
    }

    /**
     * Delete the database.
     * @param shouldRetry Whether to retry if the deletion is blocked (can happen if the database is not closed yet)
     */
    async delete(shouldRetry = false): Promise<boolean> {
        if (this.isDeleting) {
            return false;
        }
        try {
            this.isDeleting = true;
            this.close();
            const request = window.indexedDB.deleteDatabase(this.databaseName);

            const deletePromise = new Promise<void>((resolve, reject) => {
                request.onsuccess = () => {
                    resolve();
                };

                request.onerror = (event) => {
                    reject(event);
                };

                request.onblocked = () => {
                    if (shouldRetry) {
                        // retry after 2 seconds
                        console.log('Deletion of "' + this.databaseName + '" is blocked, retrying...');
                        setTimeout(() => {
                            this.delete(false).then((didDelete) => {
                                if (didDelete) {
                                    resolve();
                                    return;
                                }

                                reject();
                            }).catch((error) => {
                                reject(error);
                            });
                        }, 2000);
                        return;
                    }

                    reject(new Error(`Deletion of "${this.databaseName}" is blocked – close all open connections first.`));
                    return;
                };
            });

            await deletePromise;
            this.isDeleting = false;
            return true;
        }
        catch (e) {
            console.error(e);
            this.isDeleting = false;
            return false;
        }
    }

    /**
     * Count the items in a store.
     * @param storeName
     * @returns the number of items in a store
     */
    async countStore(storeName: WebshopStoreName): Promise<number> {
        const db = await this.get();

        const countPromise = new Promise<number>((resolve, reject) => {
            const transaction = db.transaction([storeName], 'readonly');

            transaction.onerror = (event) => {
                // Don't forget to handle errors!
                reject(event);
            };

            const countRequest = transaction.objectStore(storeName).count();
            countRequest.onsuccess = () => {
                resolve(countRequest.result);
            };
        });

        return await countPromise;
    }

    /**
     * Init all the stores in the database.
     */
    private initStores({ database, transaction, event }: { database: IDBDatabase; transaction: IDBTransaction | null; event: IDBVersionChangeEvent }) {
        const storeInitializers: ObjectStoreInitFunction[] = [initOrdersStore, initWebshopTicketsStore, initWebshopTicketPatchesStore, initWebshopSettingsStore];

        for (const initStore of storeInitializers) {
            initStore({ oldVersion: event.oldVersion, database, transaction });
        }
    }
}

export type WebshopStoreName = 'orders' | 'tickets' | 'ticketPatches' | 'settings';

function initOrdersStore({ oldVersion, database, transaction }: { oldVersion: number; database: IDBDatabase; transaction: IDBTransaction | null }) {
    const storeName: WebshopStoreName = 'orders';

    let storeToBeIndexed: IDBObjectStore | null = null;

    if (oldVersion < 1) {
        storeToBeIndexed = database.createObjectStore(storeName, { keyPath: 'value.id' });
    }
    else if (transaction) {
        const storeToClear = transaction.objectStore(storeName);
        storeToClear.clear();

        if (oldVersion < 394) {
            storeToBeIndexed = storeToClear;
        }
    }

    if (storeToBeIndexed) {
        // create indexes

        // typescript will show an error if an index is missing
        const indexes: Record<OrderIndexedDBIndex, IDBIndexParameters & { keyPath: string | Iterable<string> }>
        // auto generate indexes for generated indexes
                = Object.fromEntries(Object.values(OrderIndexedDBIndex).map((index) => {
                    return [index, { unique: false, keyPath: `indexes.${index}` }];
                })) as Record<OrderIndexedDBIndex, IDBIndexParameters & { keyPath: string | Iterable<string> }>
            ;

        Object.entries(indexes).forEach(([index, options]) => {
            storeToBeIndexed.createIndex(index, options.keyPath ?? index, options);
        });
    }
}

function initWebshopSettingsStore({ oldVersion, database, transaction }: { oldVersion: number; database: IDBDatabase; transaction: IDBTransaction | null }) {
    const storeName: WebshopStoreName = 'settings';

    if (oldVersion < 1) {
        database.createObjectStore(storeName, { });
    }
    else if (transaction) {
        const storeToClear = transaction.objectStore(storeName);
        storeToClear.clear();
    }
}

function initWebshopTicketsStore({ oldVersion, database, transaction }: { oldVersion: number; database: IDBDatabase; transaction: IDBTransaction | null }) {
    let storeToBeIndexed: IDBObjectStore | null = null;
    const storeName: WebshopStoreName = 'tickets';

    if (oldVersion < 1) {
        storeToBeIndexed = database.createObjectStore(storeName, { keyPath: 'secret' });
    }
    else if (transaction) {
        const storeToClear = transaction.objectStore(storeName);
        storeToClear.clear();

        if (oldVersion < 114) {
            storeToBeIndexed = storeToClear;
        }
    }

    if (storeToBeIndexed) {
        // create indexes
        storeToBeIndexed.createIndex('orderId', 'orderId', { unique: false });
    }
}

function initWebshopTicketPatchesStore({ oldVersion, database, transaction }: { oldVersion: number; database: IDBDatabase; transaction: IDBTransaction | null }) {
    const storeName: WebshopStoreName = 'ticketPatches';

    if (oldVersion < 1) {
        database.createObjectStore(storeName, { keyPath: 'secret' });
    }
    else if (transaction) {
        const storeToClear = transaction.objectStore(storeName);
        storeToClear.clear();
    }
}
