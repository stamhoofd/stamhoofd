import { AnyDecoder, ArrayDecoder, AutoEncoder, BooleanDecoder, DateDecoder, EnumDecoder, field, IntegerDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from 'uuid';
import { EditorSmartButton } from '../email/EditorSmartButton.js';
import { EditorSmartVariable } from '../email/EditorSmartVariable.js';
import { EmailAttachment, Recipient, replaceEmailText, Replacement } from '../endpoints/EmailRequest.js';
import { StamhoofdFilterDecoder } from '../filters/FilteredRequest.js';
import { StamhoofdFilter } from '../filters/StamhoofdFilter.js';
import { MemberDetails } from '../members/MemberDetails.js';
import { MemberWithRegistrationsBlob } from '../members/MemberWithRegistrationsBlob.js';
import { OrganizationMetaData } from '../OrganizationMetaData.js';
import { OrganizationPrivateMetaData } from '../OrganizationPrivateMetaData.js';
import { Platform } from '../Platform.js';
import { EmailTemplate } from './EmailTemplate.js';
import { SimpleErrors } from '@simonbackx/simple-errors';

export enum EmailRecipientFilterType {
    RegistrationMembers = 'RegistrationMembers',
    RegistrationParents = 'RegistrationParents',
    RegistrationUnverified = 'RegistrationUnverified',
    Members = 'Members',
    MemberParents = 'MemberParents',
    MemberUnverified = 'MemberUnverified',
    Orders = 'Orders',
    ReceivableBalances = 'ReceivableBalances',
}

export function getExampleRecipient(type: EmailRecipientFilterType | null = null) {
    return MemberWithRegistrationsBlob.create({
        details: MemberDetails.create({
            firstName: 'Jan',
            lastName: 'Janssens',
            email: 'jan.janssens@voorbeeld-emailadres.com',
        }),
    }).getEmailRecipients(['member'])[0];
}

export enum EmailStatus {
    Draft = 'Draft',
    /**
     * Queued to be sent any moment now
     */
    Queued = 'Queued',
    Sending = 'Sending',
    Sent = 'Sent',
    Deleted = 'Deleted',
    Failed = 'Failed',
}

export enum EmailRecipientsStatus {
    NotCreated = 'NotCreated',
    Creating = 'Creating',
    Created = 'Created',
}

export class EmailRecipientSubfilter extends AutoEncoder {
    @field({ decoder: new EnumDecoder(EmailRecipientFilterType) })
    type = EmailRecipientFilterType.Members;

    @field({ decoder: StamhoofdFilterDecoder, nullable: true })
    filter: StamhoofdFilter | null = null;

    @field({ decoder: StringDecoder, nullable: true })
    search: string | null = null;

    /**
     * In case the email is sent to a specific type of relation, we can filter that relation here.
     * E.g. sending an email to organziations -> filter on who to email to for a specific organization (e.g. members with specific role)
     */
    @field({ decoder: StamhoofdFilterDecoder, nullable: true, version: 346 })
    subfilter: StamhoofdFilter | null = null;
}

export class EmailRecipientFilter extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(EmailRecipientSubfilter) })
    filters: EmailRecipientSubfilter[] = [];

    @field({ decoder: BooleanDecoder })
    groupByEmail = false;
}

export class Email extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder, nullable: true, version: 379 })
    senderId: string | null = null;

    @field({ decoder: EmailRecipientFilter })
    recipientFilter = EmailRecipientFilter.create({});

    @field({ decoder: StringDecoder, nullable: true })
    subject: string | null = null;

    @field({ decoder: new EnumDecoder(EmailStatus) })
    status = EmailStatus.Draft;

    @field({ decoder: SimpleErrors, nullable: true, version: 380 })
    emailErrors: SimpleErrors | null = null;

    @field({ decoder: new EnumDecoder(EmailRecipientsStatus) })
    recipientsStatus = EmailRecipientsStatus.NotCreated;

    @field({ decoder: SimpleErrors, nullable: true, version: 380 })
    recipientsErrors: SimpleErrors | null = null;

    @field({ decoder: AnyDecoder })
    json = {};

    @field({ decoder: StringDecoder, nullable: true })
    text: string | null = null;

    @field({ decoder: StringDecoder, nullable: true })
    html: string | null = null;

    @field({ decoder: StringDecoder, nullable: true })
    fromAddress: string | null = null;

    @field({ decoder: StringDecoder, nullable: true })
    fromName: string | null = null;

    @field({ decoder: IntegerDecoder, nullable: true, field: 'recipientCount' })
    @field({ decoder: IntegerDecoder, nullable: true, version: 380, field: 'emailRecipientsCount' })
    emailRecipientsCount: number | null = null;

    @field({ decoder: IntegerDecoder, nullable: true, version: 380 })
    otherRecipientsCount: number | null = null;

    @field({ decoder: IntegerDecoder, version: 380 })
    succeededCount = 0;

    @field({ decoder: IntegerDecoder, version: 380 })
    softFailedCount = 0;

    @field({ decoder: IntegerDecoder, version: 380 })
    failedCount = 0;

    @field({ decoder: IntegerDecoder, version: 380 })
    membersCount = 0;

    @field({ decoder: new ArrayDecoder(EmailAttachment) })
    attachments: EmailAttachment[] = [];

    @field({ decoder: DateDecoder, nullable: true })
    sentAt: Date | null = null;

    @field({ decoder: DateDecoder })
    createdAt: Date = new Date();

    @field({ decoder: DateDecoder })
    updatedAt: Date = new Date();

    getTemplateType() {
        for (const filter of this.recipientFilter.filters) {
            const d = EmailTemplate.getSavedForRecipient(filter.type);
            if (d) {
                return d;
            }
        }
        return null;
    }
}

export class EmailRecipient extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder })
    emailId: string = '';

    @field({ decoder: StringDecoder, nullable: true, version: 355 })
    objectId: string | null = null;

    @field({ decoder: StringDecoder, nullable: true, version: 355 })
    emailType: string | null = null;

    @field({ decoder: StringDecoder, nullable: true })
    firstName: string | null = null;

    @field({ decoder: StringDecoder, nullable: true })
    lastName: string | null = null;

    @field({ decoder: StringDecoder })
    @field({
        decoder: StringDecoder,
        nullable: true,
        version: 380,
        downgrade: function (newer: string | null) {
            return newer ?? '';
        },
    })
    email: string | null = null;

    @field({ decoder: StringDecoder, nullable: true, version: 380 })
    memberId: string | null = null;

    @field({ decoder: StringDecoder, nullable: true, version: 380 })
    userId: string | null = null;

    @field({ decoder: new ArrayDecoder(Replacement) })
    replacements: Replacement[] = [];

    @field({ decoder: StringDecoder, nullable: true })
    failErrorMessage: string | null = null;

    @field({ decoder: IntegerDecoder })
    failCount = 0;

    @field({ decoder: SimpleErrors, nullable: true, version: 380 })
    failError: SimpleErrors | null = null;

    @field({ decoder: StringDecoder, nullable: true, version: 380 })
    hardBounceError: string | null = null;

    @field({ decoder: StringDecoder, nullable: true, version: 380 })
    softBounceError: string | null = null;

    @field({ decoder: StringDecoder, nullable: true, version: 380 })
    spamComplaintError: string | null = null;

    @field({ decoder: DateDecoder, nullable: true })
    firstFailedAt: Date | null = null;

    @field({ decoder: DateDecoder, nullable: true })
    lastFailedAt: Date | null = null;

    @field({ decoder: DateDecoder, nullable: true })
    sentAt: Date | null = null;

    @field({ decoder: DateDecoder })
    createdAt: Date = new Date();

    @field({ decoder: DateDecoder })
    updatedAt: Date = new Date();

    get name() {
        if (!this.firstName) {
            return this.lastName;
        }
        if (!this.lastName) {
            return this.firstName;
        }
        return this.firstName + ' ' + this.lastName;
    }

    getDefaultReplacements() {
        return Recipient.create({
            ...this,
            email: this.email ?? '',
        }).getDefaultReplacements();
    }

    getReplacements(organization: { meta: OrganizationMetaData; privateMeta: OrganizationPrivateMetaData | null; name: string } | null, platform: Platform) {
        return [
            ...this.replacements,
            ...this.getDefaultReplacements(),
            ...(organization ? organization.meta.getEmailReplacements(organization) : []),
            ...platform.config.getEmailReplacements(platform),
        ];
    }

    getRecipient() {
        return Recipient.create({
            ...this,
            email: this.email ?? '',
        });
    }
}

export class EmailPreview extends Email {
    @field({ decoder: EmailRecipient, nullable: true })
    exampleRecipient: EmailRecipient | null = null;

    /**
     * @deprecated
     */
    @field({ decoder: new ArrayDecoder(EditorSmartVariable), optional: true })
    smartVariables: EditorSmartVariable[] = [];

    /**
     * @deprecated
     */
    @field({ decoder: new ArrayDecoder(EditorSmartButton), optional: true })
    smartButtons: EditorSmartButton[] = [];

    // todo: count stats
    // todo: bounce / spam stats

    get replacedSubject() {
        return replaceEmailText(this.subject || '', this.exampleRecipient?.replacements || []);
    }
}
