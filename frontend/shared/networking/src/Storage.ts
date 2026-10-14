import { LocalizationStorage } from '@stamhoofd/frontend-i18n/LocalizationStorage';

/** Async-shaped string storage; missing keys return null. Implementations may throw/reject on storage failures. */
export interface KeyValueContainer {
    setItem(key: string, value: string): Promise<void>;
    getItem(key: string): Promise<string | null>;
    removeItem(key: string): Promise<void>;
}

/** Browser localStorage adapter; operations run synchronously before returning a resolved promise. */
export class LocalStorage implements KeyValueContainer {
    setItem(key: string, value: string) {
        localStorage.setItem(key, value);
        return Promise.resolve();
    }

    getItem(key: string) {
        return Promise.resolve(localStorage.getItem(key));
    }

    removeItem(key: string) {
        return Promise.resolve(localStorage.removeItem(key));
    }
}

/**
 * Overridable storage roles, not isolated namespaces: browser defaults all use the
 * same localStorage keys. Native bootstrap may replace containers. The `secure`
 * name expresses intended use, not a browser encryption/security guarantee.
 */
export class Storage {
    /**
     * For general data that could be lost
     */
    static get keyValue(): KeyValueContainer {
        return LocalizationStorage.keyValue;
    }

    static set keyValue(value: KeyValueContainer) {
        LocalizationStorage.keyValue = value;
    }

    /**
     * Use for access tokens and keys
     */
    static secure: KeyValueContainer = new LocalStorage();

    /**
     * Use for lots of keys
     */
    static keychain: KeyValueContainer = new LocalStorage();

    // TODO: database storage here for caching data and keeping it available offline
}
