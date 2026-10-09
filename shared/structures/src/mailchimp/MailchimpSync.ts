import { ArrayDecoder, AutoEncoder, BooleanDecoder, DateDecoder, EnumDecoder, field, IntegerDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from 'uuid';
import { MailchimpSyncType } from './MailchimpSyncRequest.js';

export enum MailchimpSyncStatus {
    Pending = 'Pending',
    Running = 'Running',
    Done = 'Done',
    Failed = 'Failed',
}

export enum MailchimpSyncIssueReason {
    InvalidEmail = 'InvalidEmail',
    Unsubscribed = 'Unsubscribed',
    HardBounce = 'HardBounce',
    MarkedAsSpam = 'MarkedAsSpam',
    NoConsent = 'NoConsent',
    /**
     * Mailchimp accepts updates for archived contacts but keeps them archived, so they are skipped
     */
    ArchivedInMailchimp = 'ArchivedInMailchimp',
    /**
     * Mailchimp refused the contact, see detail
     */
    Rejected = 'Rejected',
}

export class MailchimpSyncIssue extends AutoEncoder {
    @field({ decoder: StringDecoder })
    email = '';

    @field({ decoder: new EnumDecoder(MailchimpSyncIssueReason) })
    reason = MailchimpSyncIssueReason.Rejected;

    /**
     * Message from Mailchimp (English)
     */
    @field({ decoder: StringDecoder, nullable: true })
    detail: string | null = null;
}

export class MailchimpSyncResult extends AutoEncoder {
    @field({ decoder: IntegerDecoder })
    total = 0;

    @field({ decoder: IntegerDecoder })
    processed = 0;

    @field({ decoder: IntegerDecoder })
    added = 0;

    @field({ decoder: IntegerDecoder })
    updated = 0;

    /**
     * Contacts tagged as no longer registered
     */
    @field({ decoder: IntegerDecoder })
    removed = 0;

    @field({ decoder: IntegerDecoder })
    archived = 0;

    @field({ decoder: IntegerDecoder })
    skipped = 0;

    @field({ decoder: IntegerDecoder })
    failed = 0;

    /**
     * Skipped and failed addresses, capped
     */
    @field({ decoder: new ArrayDecoder(MailchimpSyncIssue) })
    issues: MailchimpSyncIssue[] = [];
}

export class MailchimpSync extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: new EnumDecoder(MailchimpSyncType) })
    type = MailchimpSyncType.Members;

    @field({ decoder: BooleanDecoder })
    full = false;

    @field({ decoder: new EnumDecoder(MailchimpSyncStatus) })
    status = MailchimpSyncStatus.Pending;

    @field({ decoder: MailchimpSyncResult })
    result = MailchimpSyncResult.create({});

    /**
     * Human readable reason why the synchronisation failed
     */
    @field({ decoder: StringDecoder, nullable: true })
    errorMessage: string | null = null;

    @field({ decoder: DateDecoder })
    createdAt = new Date();

    @field({ decoder: DateDecoder, nullable: true })
    finishedAt: Date | null = null;

    get isRunning() {
        return this.status === MailchimpSyncStatus.Pending || this.status === MailchimpSyncStatus.Running;
    }
}
