import { column } from '@simonbackx/simple-database';
import { QueryableModel } from '@stamhoofd/sql';
import { v4 as uuidv4 } from 'uuid';

/**
 * A single TOTP authenticator enrolled by a user. A user may have multiple.
 * The `secret` is stored encrypted at rest (see EncryptionHelper).
 */
export class MFATOTP extends QueryableModel {
    static table = 'mfa_totp';

    @column({
        primary: true, type: 'string', beforeSave(value) {
            return value ?? uuidv4();
        },
    })
    id!: string;

    @column({ type: 'string' })
    userId: string;

    @column({ type: 'string' })
    name = '';

    /**
     * The encrypted base32 TOTP secret.
     */
    @column({ type: 'string' })
    secret: string;

    /**
     * Null until the user has verified their first code. Unconfirmed rows do not count
     * as an enrolled factor.
     */
    @column({ type: 'datetime', nullable: true })
    confirmedAt: Date | null = null;

    @column({ type: 'datetime', nullable: true })
    lastUsedAt: Date | null = null;

    @column({
        type: 'datetime', beforeSave(old?: any) {
            if (old !== undefined) {
                return old;
            }
            const date = new Date();
            date.setMilliseconds(0);
            return date;
        },
    })
    createdAt: Date;

    @column({
        type: 'datetime', beforeSave() {
            const date = new Date();
            date.setMilliseconds(0);
            return date;
        },
        skipUpdate: true,
    })
    updatedAt: Date;

    static async getForUser(userId: string): Promise<MFATOTP[]> {
        return await this.select().where('userId', userId).fetch();
    }

    static async getConfirmedForUser(userId: string): Promise<MFATOTP[]> {
        const all = await this.getForUser(userId);
        return all.filter(t => t.confirmedAt !== null);
    }
}
