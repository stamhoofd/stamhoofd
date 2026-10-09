import { column } from '@simonbackx/simple-database';
import { QueryableModel } from '@stamhoofd/sql';
import { MailchimpSync as MailchimpSyncStruct, MailchimpSyncResult, MailchimpSyncStatus } from '@stamhoofd/structures/mailchimp/MailchimpSync.js';
import { MailchimpSyncRequest } from '@stamhoofd/structures/mailchimp/MailchimpSyncRequest.js';
import { v4 as uuidv4 } from 'uuid';

export class MailchimpSync extends QueryableModel {
    static table = 'mailchimp_syncs';

    @column({
        primary: true, type: 'string', beforeSave(value) {
            return value ?? uuidv4();
        },
    })
    id!: string;

    /**
     * Null for the platform
     */
    @column({ type: 'string', nullable: true })
    organizationId: string | null = null;

    /**
     * User who started the synchronisation
     */
    @column({ type: 'string', nullable: true })
    userId: string | null = null;

    @column({ type: 'json', decoder: MailchimpSyncRequest })
    request: MailchimpSyncRequest;

    @column({ type: 'string' })
    status = MailchimpSyncStatus.Pending;

    @column({ type: 'json', decoder: MailchimpSyncResult })
    result = MailchimpSyncResult.create({});

    @column({ type: 'string', nullable: true })
    errorMessage: string | null = null;

    @column({ type: 'datetime', nullable: true })
    finishedAt: Date | null = null;

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
        return MailchimpSyncStruct.create({
            id: this.id,
            type: this.request.type,
            full: this.request.full,
            status: this.status,
            result: this.result,
            errorMessage: this.errorMessage,
            createdAt: this.createdAt,
            finishedAt: this.finishedAt,
        });
    }
}
