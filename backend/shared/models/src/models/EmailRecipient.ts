import { column, Model, SQLResultNamespacedRow } from '@simonbackx/simple-database';
import { EmailRecipient as EmailRecipientStruct, Replacement } from '@stamhoofd/structures';
import { v4 as uuidv4 } from 'uuid';

import { ArrayDecoder } from '@simonbackx/simple-encoding';
import { SQL, SQLSelect } from '@stamhoofd/sql';

export class EmailRecipient extends Model {
    static table = 'email_recipients';

    @column({
        primary: true, type: 'string', beforeSave(value) {
            return value ?? uuidv4();
        },
    })
    id!: string;

    @column({ type: 'string' })
    emailId: string;

    @column({ type: 'string', nullable: true })
    firstName: string | null = null;

    @column({ type: 'string', nullable: true })
    lastName: string | null = null;

    @column({ type: 'string' })
    email: string;

    @column({ type: 'json', decoder: new ArrayDecoder(Replacement) })
    replacements: Replacement[] = [];

    @column({ type: 'string', nullable: true })
    failErrorMessage: string | null = null;

    @column({ type: 'integer' })
    failCount = 0;

    @column({
        type: 'datetime',
        nullable: true,
    })
    firstFailedAt: Date | null = null;

    @column({
        type: 'datetime',
        nullable: true,
    })
    lastFailedAt: Date | null = null;

    @column({
        type: 'datetime',
        nullable: true,
    })
    sentAt: Date | null = null;

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

    getStructure() {
        return EmailRecipientStruct.create(this);
    }

    /**
     * Experimental: needs to move to library
     */
    static select() {
        const transformer = (row: SQLResultNamespacedRow): EmailRecipient => {
            const d = (this as typeof EmailRecipient & typeof Model).fromRow(row[this.table] as any) as EmailRecipient | undefined;

            if (!d) {
                throw new Error('EmailTemplate not found');
            }

            return d;
        };

        const select = new SQLSelect(transformer, SQL.wildcard());
        return select.from(SQL.table(this.table));
    }
}
