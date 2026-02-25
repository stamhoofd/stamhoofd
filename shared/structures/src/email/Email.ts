import { AnyDecoder, ArrayDecoder, AutoEncoder, BooleanDecoder, DateDecoder, EnumDecoder, field, IntegerDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { SimpleErrors } from '@simonbackx/simple-errors';
import { v4 as uuidv4 } from 'uuid';
import { EmailAttachment, Recipient, replaceEmailText, Replacement } from '../endpoints/EmailRequest.js';
import { StamhoofdFilterDecoder } from '../filters/FilteredRequest.js';
import { StamhoofdFilter } from '../filters/StamhoofdFilter.js';
import { TinyMember } from '../members/Member.js';
import { MemberDetails } from '../members/MemberDetails.js';
import { MemberWithRegistrationsBlob } from '../members/MemberWithRegistrationsBlob.js';
import { BaseOrganization } from '../Organization.js';
import { OrganizationMetaData } from '../OrganizationMetaData.js';
import { OrganizationPrivateMetaData } from '../OrganizationPrivateMetaData.js';
import { Platform } from '../Platform.js';
import { User } from '../User.js';
import { EmailTemplate } from './EmailTemplate.js';

export enum EmailRecipientFilterType {
    RegistrationMembers = 'RegistrationMembers',
    RegistrationParents = 'RegistrationParents',
    RegistrationUnverified = 'RegistrationUnverified',
    // todo: rename to PaymentOther
    Payment = 'Payment',
    // distinction between payment is useful to be able to not show these in the member portal?
    PaymentOrganization = 'PaymentOrganization',
    Members = 'Members',
    MemberParents = 'MemberParents',
    MemberUnverified = 'MemberUnverified',
    Orders = 'Orders',
    ReceivableBalances = 'ReceivableBalances',
    Documents = 'Documents',
}

export function getExampleRecipient(type: EmailRecipientFilterType | null = null) {
    return MemberWithRegistrationsBlob.create({
        details: MemberDetails.create({
            firstName: $t(`65c9a375-fbca-4a27-9a42-01d49f7f9588`),
            lastName: $t(`e028c78a-166d-4531-b03b-99a573f1661b`),
            email: $t(`46e8393a-144d-477e-9b9e-c79616e4b9a7`),
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

const emailTypesToShowInMemberPortal = new Set<EmailRecipientFilterType>([
    EmailRecipientFilterType.Members,
    EmailRecipientFilterType.MemberParents,
    EmailRecipientFilterType.MemberUnverified,
    EmailRecipientFilterType.RegistrationMembers,
    EmailRecipientFilterType.RegistrationParents,
    EmailRecipientFilterType.RegistrationUnverified,
    EmailRecipientFilterType.Documents,
    EmailRecipientFilterType.Payment,
]);

export class EmailRecipientFilter extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(EmailRecipientSubfilter) })
    filters: EmailRecipientSubfilter[] = [];

    /**
     * @deprecated.
     * This doesn't do anything and is replaced by automatic email grouping.
     */
    @field({ decoder: BooleanDecoder, optional: true })
    groupByEmail = false;

    get canShowInMemberPortal() {
        for (const filter of this.filters) {
            if (emailTypesToShowInMemberPortal.has(filter.type)) {
                return true;
            }
        }
        return false;
    }
}

export class Email extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder, nullable: true, version: 379 })
    senderId: string | null = null;

    @field({ decoder: StringDecoder, nullable: true, version: 383 })
    organizationId: string | null = null;

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

    @field({ decoder: IntegerDecoder, nullable: true, version: 381 })
    hardBouncesCount = 0;

    @field({ decoder: IntegerDecoder, nullable: true, version: 381 })
    softBouncesCount = 0;

    @field({ decoder: IntegerDecoder, nullable: true, version: 381 })
    spamComplaintsCount = 0;

    @field({ decoder: new ArrayDecoder(EmailAttachment) })
    attachments: EmailAttachment[] = [];

    @field({ decoder: DateDecoder, nullable: true })
    sentAt: Date | null = null;

    @field({ decoder: DateDecoder })
    createdAt: Date = new Date();

    @field({ decoder: DateDecoder })
    updatedAt: Date = new Date();

    @field({ decoder: DateDecoder, nullable: true, version: 382 })
    deletedAt: Date | null = null;

    @field({ decoder: BooleanDecoder, version: 384 })
    sendAsEmail = true;

    @field({ decoder: BooleanDecoder, version: 384 })
    showInMemberPortal = false;

    getTemplateType() {
        for (const filter of this.recipientFilter.filters) {
            const d = EmailTemplate.getSavedForRecipient(filter.type);
            if (d) {
                return d;
            }
        }
        return null;
    }

    getSubjectFor(recipient: EmailRecipient | null) {
        return replaceEmailText(this.subject || '', recipient?.replacements || []);
    }

    getSnippetFor(recipient: EmailRecipient | null) {
        if (!this.text) {
            return '';
        }

        // Trim starting/ending whitespaces and newline from this.text
        let stripped = this.text.trim();

        // Remove duplicate newlines
        stripped = stripped.replace(/\n+/g, '\n');

        // Remove certain strings:
        // {{greeting}}
        // Dag {{firstName}},
        // Beste,

        const stripStrings = ['{{greeting}}', 'Dag {{firstName}},', 'Beste,', 'Beste {{firstName}},', 'Geachte,', 'Hallo,'];

        if (this.subject) {
            stripStrings.push(this.subject);
        }

        for (const str of stripStrings) {
            if (stripped.startsWith(str)) {
                stripped = stripped.substring(str.length).trim();
            }
        }

        // Remove all (https?://...) links, including the parentheses
        stripped = stripped.replace(/\(https?:\/\/[^\s)]+\)/g, '').trim();

        // Remove all ({{something}}) replacements, including the parentheses - these are often buttons or urls
        stripped = stripped.replace(/\(\{\{[^\s)]+\}\}\)/g, '').trim();

        // Remove all links that are on their own line
        stripped = stripped.replace(/^\s*https?:\/\/[^\s)]+\s*$/gm, '').trim();

        // Remove duplicate spaces
        stripped = stripped.replace(/[ \t]+/g, ' ');

        // Limit to first 2 lines
        const lines = stripped.split('\n').slice(0, 4);
        stripped = lines.join(' ');

        stripped = replaceEmailText(stripped, recipient?.replacements || []);
        if (stripped.length < 50) {
            // Not worth showing, probably something confusing
            return '';
        }
        return stripped;
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

    @field({ decoder: TinyMember, nullable: true, version: 383 })
    member: TinyMember | null = null;

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

    @field({ decoder: SimpleErrors, nullable: true, version: 385 })
    previousFailError: SimpleErrors | null = null;

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

    getReplacements(organization: { meta: OrganizationMetaData; privateMeta: OrganizationPrivateMetaData | null; name: string; registerUrl: string } | null, platform: Platform) {
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

export function isSoftEmailRecipientError(error: SimpleErrors) {
    if (error.hasCode('email_skipped_unsubscribed')) {
        return true;
    }
    if (error.hasCode('email_skipped_duplicate_recipient')) {
        return true;
    }
    return false;
}

export function bounceErrorToHuman(message: string) {
    message = message.toLowerCase();
    if (message.startsWith('smtp; 554 4.4.7') || message.includes('storage') || message.includes('quota') || message.match(/inbox.*full/)) {
        return $t('048392a6-9ee6-42f8-b5ec-599a9c305d4a');
    }

    if (message.includes('failed to establish connection') || message.includes('connection timed out')) {
        return $t('f9735e0b-84b6-4f9f-a376-c171bacc9824');
    }

    if (message.includes('unable to lookup dns')) {
        return $t('7f3706ef-3d92-4e2d-ac88-84ede374ac7c');
    }

    if (message.includes('hop count exceeded')) {
        return $t('4770f2c6-774f-4b5d-96fc-6226c7c57573');
    }

    if (message.includes('recipient address rejected: access denied') || message.includes('user does not exist') || message.includes('user unknown') || message.includes('the email account that you tried to reach does not exist')) {
        return $t('7f8ae6ce-ac5d-48e8-aa9f-223a849aab02');
    }
}

export class EmailPreview extends Email {
    @field({ decoder: EmailRecipient, nullable: true })
    exampleRecipient: EmailRecipient | null = null;

    @field({ decoder: User, nullable: true, version: 383 })
    user: User | null = null;

    @field({ decoder: BaseOrganization, nullable: true, version: 383 })
    organization: BaseOrganization | null = null;

    get replacedSubject() {
        return this.getSubjectFor(this.exampleRecipient);
    }

    get snippet() {
        return this.getSnippetFor(this.exampleRecipient);
    }
}

export class EmailWithRecipients extends Email {
    @field({ decoder: new ArrayDecoder(EmailRecipient) })
    recipients: EmailRecipient[] = [];

    @field({ decoder: BaseOrganization, nullable: true, version: 383 })
    organization: BaseOrganization | null = null;

    get exampleRecipient() {
        return this.recipients[0] ?? null;
    }

    get replacedSubject() {
        return this.getSubjectFor(this.exampleRecipient);
    }

    get snippet() {
        return this.getSnippetFor(this.exampleRecipient);
    }
}
