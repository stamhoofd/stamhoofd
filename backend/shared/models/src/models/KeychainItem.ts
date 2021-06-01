import { column,Model } from '@simonbackx/simple-database';
import { v4 as uuidv4 } from "uuid";

export class KeychainItem extends Model {
    static table = "keychain"

    // Columns
    @column({
        primary: true, type: "string", beforeSave(value) {
            return value ?? uuidv4();
        }
    })
    id!: string;

    @column({ type: "string" })
    userId: string;

    @column({ type: "string" })
    publicKey: string

    @column({ type: "string" })
    encryptedPrivateKey: string

    @column({
        type: "datetime", beforeSave(old?: any) {
            if (old !== undefined) {
                return old;
            }
            const date = new Date()
            date.setMilliseconds(0)
            return date
        }
    })
    createdAt: Date

    @column({
        type: "datetime", beforeSave() {
            const date = new Date()
            date.setMilliseconds(0)
            return date
        },
        skipUpdate: true
    })
    updatedAt: Date
}