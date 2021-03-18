import { KeychainItem } from '@stamhoofd/structures';

/**
 * Holds encrypted keys in memory for the current user
 */
export class KeychainStatic {
    items: Map<string, KeychainItem> = new Map()

    addItem(item: KeychainItem) {
        this.items.set(item.publicKey, item)
    }

    addItems(items: KeychainItem[]) {
        for (const item of items) {
            this.addItem(item)
        }
    }

    removeItem(publicKey: string) {
        this.items.delete(publicKey)
    }

    getItem(publicKey: string) {
        return this.items.get(publicKey)
    }

    hasItem(publicKey: string) {
        return this.items.has(publicKey)
    }
}

export const Keychain = new KeychainStatic()