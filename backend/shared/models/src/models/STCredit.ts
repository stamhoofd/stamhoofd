import { column, Model } from '@simonbackx/simple-database';
import { v4 as uuidv4 } from 'uuid';

export class STCredit extends Model {
    static table = 'stamhoofd_credits';

    // Columns
    @column({
        primary: true, type: 'string', beforeSave(value) {
            return value ?? uuidv4();
        },
    })
    id!: string;

    @column({ type: 'string' })
    organizationId: string;

    @column({ type: 'string' })
    description: string;

    @column({ type: 'integer' })
    change: number;

    @column({ type: 'boolean' })
    allowTransactions = false;

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

    @column({ type: 'datetime', nullable: true })
    expireAt: Date | null = null;

    @column({
        type: 'datetime', beforeSave() {
            const date = new Date();
            date.setMilliseconds(0);
            return date;
        },
        skipUpdate: true,
    })
    updatedAt: Date;
}
