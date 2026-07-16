import { column } from '@simonbackx/simple-database';
import { QueryableModel } from '@stamhoofd/sql';
import { v4 as uuidv4 } from 'uuid';

/**
 * A single-use recovery (backup) code. Only the Argon2 hash is stored. A user has one
 * active batch; regenerating deletes the old batch.
 */
export class MFARecoveryCode extends QueryableModel {
    static table = 'mfa_recovery_codes';

    @column({
        primary: true, type: 'string', beforeSave(value) {
            return value ?? uuidv4();
        },
    })
    id!: string;

    @column({ type: 'string' })
    userId: string;

    @column({ type: 'string' })
    codeHash: string;

    @column({ type: 'datetime', nullable: true })
    usedAt: Date | null = null;

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

    static async getForUser(userId: string): Promise<MFARecoveryCode[]> {
        return await this.select().where('userId', userId).fetch();
    }

    static async getUnusedForUser(userId: string): Promise<MFARecoveryCode[]> {
        const all = await this.getForUser(userId);
        return all.filter(c => c.usedAt === null);
    }

    static async deleteForUser(userId: string): Promise<void> {
        await this.delete().where('userId', userId);
    }
}
