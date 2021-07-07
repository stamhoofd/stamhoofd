export interface KeyValueContainer {
    setItem(key: string, value: string): Promise<void>
    getItem(key: string): Promise<string | null>
    removeItem(key: string): Promise<void>
}

export class LocalStorage implements KeyValueContainer {
    setItem(key: string, value: string) {
        localStorage.setItem(key, value)
        return Promise.resolve()
    }

    getItem(key: string) {
        return Promise.resolve(localStorage.getItem(key))
    }

    removeItem(key: string) {
        return Promise.resolve(localStorage.removeItem(key))
    }
}

/**
 * Allow to explicitly override storage container depending on environment
 */
export class Storage {
    /**
     * For general data that could be lost
     */
    static keyValue: KeyValueContainer = new LocalStorage()
    
    /**
     * Use for access tokens and keys
     */
    static secure: KeyValueContainer = new LocalStorage()

    /**
     * Use for lots of keys
     */
    static keychain: KeyValueContainer = new LocalStorage()

    // TODO: database storage here for caching data and keeping it available offline
}