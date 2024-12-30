import { column } from '@simonbackx/simple-database';
import { QueryableModel } from '@stamhoofd/sql';
import { v4 as uuidv4 } from 'uuid';

export class UsedRegisterCode extends QueryableModel {
    static table = 'used_register_codes';

    @column({
        primary: true, type: 'string', beforeSave(value) {
            return value ?? uuidv4();
        },
    })
    id!: string;

    @column({ type: 'string' })
    code: string;

    /**
     * Code is used by...
     */
    @column({ type: 'string' })
    organizationId: string;

    /**
     * Set if this has been rewarded
     */
    @column({ type: 'string', nullable: true })
    creditId: string | null = null;

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
}
