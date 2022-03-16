import { Decoder, MapDecoder, ObjectData, StringDecoder, VersionBox, VersionBoxDecoder } from '@simonbackx/simple-encoding';
import { KeychainItem, Version } from '@stamhoofd/structures';

import { Storage } from './Storage';

/**
 * Holds encrypted keys in memory for the current user
 */
export class KeychainStatic {
    items: Map<string, KeychainItem> = new Map()

    addItem(item: KeychainItem, save = true) {
        this.items.set(item.publicKey, item)
        if (save) {
            this.save().catch(console.error)
        }
    }

    addItems(items: KeychainItem[]) {
        for (const item of items) {
            this.addItem(item, false)
        }
        this.save().catch(console.error)
    }

    removeItem(publicKey: string) {
        this.items.delete(publicKey)
        this.save().catch(console.error)
    }

    getItem(publicKey: string) {
        return this.items.get(publicKey)
    }

    hasItem(publicKey: string) {
        return this.items.has(publicKey)
    }

    /// In the app we store the keychain to allow better offline usage and to allow faster startup speeds
    async save() {
        // todo: use other storage mechanism
        try {
            await Storage.keychain.setItem("keychain", JSON.stringify(new VersionBox(this.items).encode({ version: Version })))
        } catch (e) {
            console.error("Failed to save keychain")
            console.error(e)
        }
    }

    async load(append = true) {
        try {
            const json = await Storage.keychain.getItem("keychain")
            if (json) {
                const data = new ObjectData(JSON.parse(json), { version: 0 })
                const versionBox = new VersionBoxDecoder(new MapDecoder(StringDecoder, KeychainItem as Decoder<KeychainItem>)).decode(data)

                if (append) {
                    for (const [publicKey, item] of versionBox.data) {
                        this.items.set(publicKey, item)
                    }
                } else {
                    this.items = versionBox.data
                }
                console.log('Loaded keychain from storage')
            }
        } catch (e) {
            console.error("Failed to load keychain")
            console.error(e)
        }
    }
}

export const Keychain = new KeychainStatic()