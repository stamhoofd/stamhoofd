import { column, Model } from "@simonbackx/simple-database";
import basex from "base-x";
import crypto from "crypto";
const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const bs58 = basex(ALPHABET)

async function randomBytes(size: number): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        crypto.randomBytes(size, (err: Error | null, buf: Buffer) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(buf);
        });
    });
}

export class RegisterCode extends Model {
    static table = "registerCodes";

    @column({ type: "string", primary: true })
    code: string;

    @column({ type: "string" })
    description: string;

    @column({ type: "string", nullable: true })
    organizationId: string | null;

    @column({ type: "integer" })
    value: number;

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
        }
    })
    updatedAt: Date

    async generateCode() {
        this.code = bs58.encode(await randomBytes(8)).toUpperCase();
    }
}
