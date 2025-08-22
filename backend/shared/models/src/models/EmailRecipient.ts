import { column } from '@simonbackx/simple-database';
import { EmailRecipient as EmailRecipientStruct, Recipient, Replacement } from '@stamhoofd/structures';
import { v4 as uuidv4 } from 'uuid';

import { ArrayDecoder } from '@simonbackx/simple-encoding';
import { QueryableModel } from '@stamhoofd/sql';
import { SimpleErrors } from '@simonbackx/simple-errors';

export class EmailRecipient extends QueryableModel {
    static table = 'email_recipients';

    @column({
        primary: true, type: 'string', beforeSave(value) {
            return value ?? uuidv4();
        },
    })
    id!: string;

    @column({ type: 'string' })
    emailId: string;

    /**
     * Helper to prevent sending too many emails to the same person.
     * Allows for filtering on objects that didn't receive a specific email yet
     */
    @column({ type: 'string', nullable: true })
    objectId: string | null = null;

    /**
     * Helper to prevent sending too many emails to the same person.
     * Allows for filtering on objects that didn't receive a specific email yet
     */
    @column({ type: 'string', nullable: true })
    emailType: string | null = null;

    @column({ type: 'string', nullable: true })
    firstName: string | null = null;

    @column({ type: 'string', nullable: true })
    lastName: string | null = null;

    @column({ type: 'string' })
    email: string;

    @column({ type: 'json', decoder: new ArrayDecoder(Replacement) })
    replacements: Replacement[] = [];

    /**
     * @deprecated
     * Legacy field
     */
    @column({ type: 'string', nullable: true })
    failErrorMessage: string | null = null;

    @column({ type: 'json', nullable: true, decoder: SimpleErrors })
    failError: SimpleErrors | null = null;

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

    getRecipient() {
        return this.getStructure().getRecipient();
    }
}
