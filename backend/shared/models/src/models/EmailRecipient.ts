import { column } from '@simonbackx/simple-database';
import { EmailRecipient as EmailRecipientStruct, Recipient, Replacement, TinyMember } from '@stamhoofd/structures';
import { v4 as uuidv4 } from 'uuid';

import { ArrayDecoder } from '@simonbackx/simple-encoding';
import { QueryableModel } from '@stamhoofd/sql';
import { SimpleErrors } from '@simonbackx/simple-errors';
import { Formatter } from '@stamhoofd/utility';
import { Member } from './Member.js';

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

    @column({ type: 'string', nullable: true })
    email: string | null = null;

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

    @column({ type: 'json', nullable: true, decoder: SimpleErrors })
    previousFailError: SimpleErrors | null = null;

    @column({ type: 'string', nullable: true })
    organizationId: string | null = null;

    /**
     * When set, the member will be ablse to see this message in the member portal.
     */
    @column({ type: 'string', nullable: true })
    memberId: string | null = null;

    /**
     * When set, the user will be able to see this message in the member portal.
     */
    @column({ type: 'string', nullable: true })
    userId: string | null = null;

    /**
     * Won't get send if it is a duplicate of another email recipient.
     */
    @column({ type: 'string', nullable: true })
    duplicateOfRecipientId: string | null = null;

    /**
     * Set when the email was send, but we received a hard bounce for this specific email
     * Contains the full output we received in the bounce
     */
    @column({ type: 'string', nullable: true })
    hardBounceError: string | null = null;

    /**
     * Set when the email was send, but we received a soft bounce for this specific email
     * Contains the full output we received in the bounce
     */
    @column({ type: 'string', nullable: true })
    softBounceError: string | null = null;

    /**
     * Set when the email was send, but was marked as spam.
     * The error message contains any relevant info we received from our provider. E.g. type of spam (virus, fraud, abuse...)
     */
    @column({ type: 'string', nullable: true })
    spamComplaintError: string | null = null;

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

    async getStructure() {
        return (await EmailRecipient.getStructures([this]))[0];
    }

    getStructureWithoutRelations() {
        return EmailRecipientStruct.create(this);
    }

    static async getStructures(models: EmailRecipient[]) {
        const memberIds = Formatter.uniqueArray(models.map(m => m.memberId).filter(m => m) as string[]);
        const members = await Member.getByIDs(...memberIds);
        return models.map((m) => {
            const struct = EmailRecipientStruct.create(m);

            if (m.memberId) {
                const member = members.find(me => me.id === m.memberId);
                if (member) {
                    struct.member = TinyMember.create(member);
                }
            }

            return struct;
        });
    }

    getRecipient() {
        return this.getStructureWithoutRelations().getRecipient();
    }
}
