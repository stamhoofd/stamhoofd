import { toRaw } from 'vue';
import { WebshopDatabase } from './WebshopDatabase';

// enum to prevent typos and keep overview of existing keys
export enum WebshopSettingsKeys {
    DisabledProducts = 'disabledProducts',
    Webshop = 'webshop',
    LastFetchedOrder = 'lastFetchedOrder',
    LastFetchedTicket = 'lastFetchedTicket',
}

type WebshopSettingsKey = `${WebshopSettingsKeys}`;

/**
 * Offline storage for webshop settings.
 */
export class WebshopSettingsStore {
    static readonly storeName = 'settings';

    constructor(private readonly database: WebshopDatabase) {
    }

    async set(key: WebshopSettingsKey, value: any) {
        const db = await this.database.get();

        return new Promise<void>((resolve, reject) => {
            const transaction = db.transaction([WebshopSettingsStore.storeName], 'readwrite');

            transaction.oncomplete = () => {
                resolve();
            };

            transaction.onerror = (event) => {
                // Don't forget to handle errors!
                reject(event);
            };

            // Do the actual saving
            const objectStore = transaction.objectStore(WebshopSettingsStore.storeName);

            // Unref potential proxies here
            objectStore.put(toRaw(value), key);
        });
    }

    async get<T = any>(key: WebshopSettingsKey): Promise<T | undefined> {
        const db = await this.database.get();

        return new Promise<T | undefined>((resolve, reject) => {
            const transaction = db.transaction([WebshopSettingsStore.storeName], 'readonly');

            transaction.onerror = (event) => {
                // Don't forget to handle errors!
                reject(event);
            };

            // Do the actual saving
            const objectStore = transaction.objectStore(WebshopSettingsStore.storeName);
            const request = objectStore.get(key);

            request.onsuccess = () => {
                resolve(request.result as T | undefined);
            };
        });
    }

    static _init({ oldVersion, database, transaction }: { oldVersion: number; database: IDBDatabase; transaction: IDBTransaction | null }) {
        if (oldVersion < 1) {
            database.createObjectStore(WebshopSettingsStore.storeName, { });
        }
        else if (transaction) {
            const storeToClear = transaction.objectStore(WebshopSettingsStore.storeName);
            storeToClear.clear();
        }
    }
}
