import { column } from '@simonbackx/simple-database';
import { BaseOrganization, EmailAttachment, EmailPreview, EmailRecipientFilter, EmailRecipientFilterType, EmailRecipientsStatus, EmailRecipient as EmailRecipientStruct, EmailStatus, Email as EmailStruct, EmailTemplateType, EmailWithRecipients, getExampleRecipient, isSoftEmailRecipientError, LimitedFilteredRequest, PaginatedResponse, SortItemDirection, StamhoofdFilter, User as UserStruct } from '@stamhoofd/structures';
import { v4 as uuidv4 } from 'uuid';

import { AnyDecoder, ArrayDecoder } from '@simonbackx/simple-encoding';
import { isSimpleError, isSimpleErrors, SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { I18n } from '@stamhoofd/backend-i18n';
import { Email as EmailClass, EmailInterfaceRecipient } from '@stamhoofd/email';
import { isAbortedError, QueueHandler, QueueHandlerOptions } from '@stamhoofd/queues';
import { QueryableModel, readDynamicSQLExpression, SQL, SQLAlias, SQLCalculation, SQLCount, SQLPlusSign, SQLSelectAs, SQLWhereSign } from '@stamhoofd/sql';
import { canSendFromEmail, fillRecipientReplacements, getEmailBuilder, mergeReplacementsIfEqual, removeUnusedReplacements, stripRecipientReplacementsForWebDisplay, stripSensitiveRecipientReplacements } from '../helpers/EmailBuilder.js';
import { EmailRecipient } from './EmailRecipient.js';
import { EmailTemplate } from './EmailTemplate.js';
import { Organization } from './Organization.js';
import { Platform } from './Platform.js';
import { User } from './User.js';

type Attachment = { filename: string; path?: string; href?: string; content?: string | Buffer; contentType?: string; encoding?: string };

function errorToSimpleErrors(e: unknown) {
    if (isSimpleErrors(e)) {
        return e;
    }
    else if (isSimpleError(e)) {
        return new SimpleErrors(e);
    }
    else {
        return new SimpleErrors(
            new SimpleError({
                code: 'unknown_error',
                message: ((typeof e === 'object' && e !== null && 'message' in e && typeof e.message === 'string') ? e.message : 'Unknown error'),
                human: $t(`41db9fc8-77f4-49a7-a77b-40a4ae8c4d8f`),
            }),
        );
    }
}

export type RecipientLoader<BeforeFetchAllResult = any> = {
    /**
     * Run one or multiple queries before fetching all recipients.
     * The result of this function will be passed to the `fetch` function.
     */
    beforeFetchAll?: (request: LimitedFilteredRequest, subfilter: StamhoofdFilter | null) => Promise<BeforeFetchAllResult>;
    fetch(request: LimitedFilteredRequest, subfilter: StamhoofdFilter | null, beforeFetchAllResult?: BeforeFetchAllResult): Promise<PaginatedResponse<EmailRecipientStruct[], LimitedFilteredRequest>>;
    count(request: LimitedFilteredRequest, subfilter: StamhoofdFilter | null): Promise<number>;
};

export class Email extends QueryableModel {
    static table = 'emails';

    @column({
        primary: true, type: 'string', beforeSave(value) {
            return value ?? uuidv4();
        },
    })
    id!: string;

    @column({ type: 'string', nullable: true })
    organizationId: string | null = null;

    @column({ type: 'string', nullable: true })
    senderId: string | null = null;

    @column({ type: 'string', nullable: true })
    userId: string | null = null;

    /**
     * Send the message as an email.
     * You can't edit this after the message has been published.
     *
     * If false, when sending the message, it will switch to 'Sent' directly without adjusting the email_recipients directly.
     */
    @column({ type: 'boolean' })
    sendAsEmail = true;

    /**
     * Show the message in the member portal
     *
     * Note: status should be 'Sent' for the message to be visible
     */
    @column({ type: 'boolean' })
    showInMemberPortal = true;

    @column({ type: 'json', decoder: EmailRecipientFilter })
    recipientFilter: EmailRecipientFilter = EmailRecipientFilter.create({});

    /**
     * Helper to prevent sending too many emails to the same person.
     * Allows for filtering on objects that didn't receive a specific email yet
     */
    @column({ type: 'string', nullable: true })
    emailType: string | null = null;

    @column({ type: 'string', nullable: true })
    subject: string | null;

    /** Raw json structure to edit the template */
    @column({ type: 'json', decoder: AnyDecoder })
    json: any = {};

    @column({ type: 'string', nullable: true })
    html: string | null = null;

    @column({ type: 'string', nullable: true })
    text: string | null = null;

    @column({ type: 'string', nullable: true })
    fromAddress: string | null = null;

    @column({ type: 'string', nullable: true })
    fromName: string | null = null;

    /**
     * Amount of recipients with an email address
     */
    @column({ type: 'integer', nullable: true })
    emailRecipientsCount: number | null = null;

    /**
     * Amount of recipients without an email address
     */
    @column({ type: 'integer', nullable: true })
    otherRecipientsCount: number | null = null;

    /**
     * Amount of recipients that have successfully received the email.
     */
    @column({ type: 'integer' })
    succeededCount = 0;

    /**
     * Amount of recipients that somehow failed to receive the email,
     * but with a soft error that doesn't require action.
     * - Duplicate email in recipient list
     * - Unsubscribed
     */
    @column({ type: 'integer' })
    softFailedCount = 0;

    /**
     * Amount of recipients that somehow failed to receive the email:
     * - Invalid email address
     * - Full email inbox
     */
    @column({ type: 'integer' })
    failedCount = 0;

    /**
     * Unique amount of members that are in the recipients list.
     */
    @column({ type: 'integer' })
    membersCount = 0;

    /**
     * Does only include bounces AFTER sending the email
     */
    @column({ type: 'integer' })
    hardBouncesCount = 0;

    /**
     * Does only include bounces AFTER sending the email
     */
    @column({ type: 'integer' })
    softBouncesCount = 0;

    /**
     * Does only include bounces AFTER sending the email
     */
    @column({ type: 'integer' })
    spamComplaintsCount = 0;

    @column({ type: 'string' })
    status = EmailStatus.Draft;

    @column({ type: 'string' })
    recipientsStatus = EmailRecipientsStatus.NotCreated;

    /**
     * Errors related to creating the recipients.
     */
    @column({ type: 'json', nullable: true, decoder: SimpleErrors })
    recipientsErrors: SimpleErrors | null = null;

    /**
     * Errors related to sending the email.
     */
    @column({ type: 'json', nullable: true, decoder: SimpleErrors })
    emailErrors: SimpleErrors | null = null;

    /**
     * todo: ignore automatically
     */
    @column({ type: 'json', decoder: new ArrayDecoder(EmailAttachment) })
    attachments: EmailAttachment[] = [];

    @column({
        type: 'datetime',
        nullable: true,
    })
    sentAt: Date | null = null;

    @column({
        type: 'datetime',
        nullable: true,
    })
    deletedAt: Date | null = null;

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

    static recipientLoaders: Map<EmailRecipientFilterType, RecipientLoader> = new Map();

    static pendingNotificationCountUpdates: Map<string, { timer: NodeJS.Timeout | null; lastUpdate: Date | null }> = new Map();

    throwIfNotReadyToSend() {
        if (this.subject == null || this.subject.length == 0) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Missing subject',
                human: $t(`e78c8218-4d25-413b-ae6b-fd916e663e5a`),
            });
        }

        if (this.text == null || this.text.length == 0) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Missing text',
                human: $t(`65b701a3-c74c-4eb6-b98e-7b9dcad0a358`),
            });
        }

        if (this.html == null || this.html.length == 0) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Missing html',
                human: $t(`65b701a3-c74c-4eb6-b98e-7b9dcad0a358`),
            });
        }

        if (this.fromAddress == null || this.fromAddress.length == 0) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Missing from',
                human: $t(`e92cd077-b0f1-4b0a-82a0-8a8baa82e73a`),
            });
        }

        if (this.status === EmailStatus.Draft && this.recipientsErrors !== null && this.recipientsStatus !== EmailRecipientsStatus.Created) {
            throw new SimpleError({
                code: 'invalid_recipients',
                message: 'Failed to build recipients (count)',
                human: $t(`457ec920-2867-4d59-bbec-4466677e1b50`) + ' ' + this.recipientsErrors.getHuman(),
            });
        }

        if (this.deletedAt) {
            throw new SimpleError({
                code: 'invalid_state',
                message: 'Email is deleted',
                human: $t(`a0524f41-bdde-4fcc-9a9a-9350905377d8`),
            });
        }

        this.validateAttachments();
    }

    throwIfNoUnsubscribeButton() {
        if (this.sendAsEmail === false) {
            return;
        }

        if (this.emailType) {
            // System email, no need for unsubscribe button
            return;
        }

        const replacement = '{{unsubscribeUrl}}';

        if (this.html) {
            // Check email contains an unsubscribe button
            if (!this.html.includes(replacement)) {
                throw new SimpleError({
                    code: 'missing_unsubscribe_button',
                    message: 'Missing unsubscribe button',
                    human: $t(`dd55e04b-e5d9-4d9a-befc-443eef4175a8`),
                    field: 'html',
                });
            }
        }

        if (this.text) {
            // Check email contains an unsubscribe button
            if (!this.text.includes(replacement)) {
                throw new SimpleError({
                    code: 'missing_unsubscribe_button',
                    message: 'Missing unsubscribe button',
                    human: $t(`dd55e04b-e5d9-4d9a-befc-443eef4175a8`),
                    field: 'text',
                });
            }
        }
    }

    validateAttachments() {
        // Validate attachments
        const size = this.attachments.reduce((value: number, attachment) => {
            return value + attachment.bytes;
        }, 0);

        if (size > 9.5 * 1024 * 1024) {
            throw new SimpleError({
                code: 'too_big_attachments',
                message: 'Too big attachments',
                human: $t(`e8b9a1db-97d0-410e-99b2-6a87c1087593`),
                field: 'attachments',
            });
        }

        const safeContentTypes = [
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/pdf',
            'image/jpeg',
            'image/png',
            'image/gif',
        ];

        for (const attachment of this.attachments) {
            if (attachment.contentType && !safeContentTypes.includes(attachment.contentType)) {
                throw new SimpleError({
                    code: 'content_type_not_supported',
                    message: 'Content-Type not supported',
                    human: $t(`54da84d6-5f6a-4db2-be34-9ddb7f47bbe8`),
                    field: 'attachments',
                });
            }

            if (!attachment.content) {
                if (!attachment.file) {
                    throw new SimpleError({
                        code: 'invalid_attachment',
                        message: 'Invalid attachment: missing file or content',
                        field: 'attachments',
                    });
                }

                if (!attachment.file.isPrivate) {
                    throw new SimpleError({
                        code: 'invalid_attachment',
                        message: 'Invalid attachment: file must be private',
                        field: 'attachments',
                    });
                }

                if (!attachment.file.signature) {
                    throw new SimpleError({
                        code: 'invalid_attachment',
                        message: 'Invalid attachment: file must be signed',
                        field: 'attachments',
                    });
                }
            }
        }
    }

    getFromAddress() {
        if (!this.fromName) {
            return {
                email: this.fromAddress!,
            };
        }

        return {
            name: this.fromName,
            email: this.fromAddress!,
        };
    }

    getDefaultFromAddress(organization?: Organization | null): EmailInterfaceRecipient {
        const i18n = new I18n($getLanguage(), $getCountry());
        let address: EmailInterfaceRecipient = {
            email: 'noreply@' + i18n.localizedDomains.defaultBroadcastEmail(),
        };

        if (organization) {
            address = organization.getDefaultFrom(organization.i18n, 'broadcast');
        }

        if (!this.fromName) {
            return address;
        }

        return {
            name: this.fromName,
            email: address.email,
        };
    }

    async setFromTemplate(type: EmailTemplateType) {
        // Most specific template: for specific group
        let templates = (await EmailTemplate.where({ type, organizationId: this.organizationId, groupId: null, webshopId: null }));

        // Then default
        if (templates.length === 0 && this.organizationId) {
            templates = (await EmailTemplate.where({ type, organizationId: null, groupId: null, webshopId: null }));
        }

        if (templates.length === 0) {
            // No default
            return false;
        }
        const defaultTemplate = templates[0];
        this.html = defaultTemplate.html;
        this.text = defaultTemplate.text;
        this.subject = defaultTemplate.subject;
        this.json = defaultTemplate.json;

        return true;
    }

    async lock<T>(callback: (upToDate: Email, options: QueueHandlerOptions) => Promise<T> | T): Promise<T> {
        if (!this.id) {
            await this.save();
        }
        const id = this.id;
        return await QueueHandler.schedule('lock-email-' + id, async (options) => {
            const upToDate = await Email.getByID(id);
            if (!upToDate) {
                throw new SimpleError({
                    code: 'not_found',
                    message: 'Email not found',
                    human: $t(`55899a7c-f3d4-43fe-a431-70a3a9e78e34`),
                });
            }
            const c = await callback(upToDate, options);
            this.copyFrom(upToDate);
            return c;
        });
    }

    static async bumpNotificationCount(emailId: string, type: 'hard-bounce' | 'soft-bounce' | 'complaint') {
        // Send an update query
        const base = Email.update()
            .where('id', emailId);

        switch (type) {
            case 'hard-bounce': {
                base.set('hardBouncesCount', new SQLCalculation(
                    SQL.column('hardBouncesCount'),
                    new SQLPlusSign(),
                    readDynamicSQLExpression(1),
                ));
                break;
            }
            case 'soft-bounce': {
                base.set('softBouncesCount', new SQLCalculation(
                    SQL.column('softBouncesCount'),
                    new SQLPlusSign(),
                    readDynamicSQLExpression(1),
                ));
                break;
            }
            case 'complaint': {
                base.set('spamComplaintsCount', new SQLCalculation(
                    SQL.column('spamComplaintsCount'),
                    new SQLPlusSign(),
                    readDynamicSQLExpression(1),
                ));
                break;
            }
        }

        await base.update();

        await this.checkNeedsNotificationCountUpdate(emailId, true);
    }

    static async checkNeedsNotificationCountUpdate(emailId: string, didUpdate = false) {
        const existing = this.pendingNotificationCountUpdates.get(emailId);
        const object = existing ?? {
            timer: null,
            lastUpdate: didUpdate ? new Date() : null,
        };

        if (didUpdate) {
            object.lastUpdate = new Date();
        }

        if (existing) {
            this.pendingNotificationCountUpdates.set(emailId, object);
        }

        if (object.lastUpdate && object.lastUpdate < new Date(Date.now() - 5 * 60 * 1000)) {
            // After 5 minutes without notifications, run an update.
            await this.updateNotificationsCounts(emailId);

            // Stop here
            return;
        }

        // Schedule a slow update of all counts
        if (!object.timer) {
            object.timer = setTimeout(() => {
                object.timer = null;
                this.checkNeedsNotificationCountUpdate(emailId).catch(console.error);
            }, 1 * 60 * 1000);
        }
    }

    static async updateNotificationsCounts(emailId: string) {
        QueueHandler.cancel('updateNotificationsCounts-' + emailId);
        return await QueueHandler.schedule('updateNotificationsCounts-' + emailId, async () => {
            const query = SQL.select(
                new SQLSelectAs(
                    new SQLCount(
                        SQL.column('hardBounceError'),
                    ),
                    new SQLAlias('data__hardBounces'),
                ),
                // If the current amount_due is negative, we can ignore that negative part if there is a future due item
                new SQLSelectAs(
                    new SQLCount(
                        SQL.column('softBounceError'),
                    ),
                    new SQLAlias('data__softBounces'),
                ),

                new SQLSelectAs(
                    new SQLCount(
                        SQL.column('spamComplaintError'),
                    ),
                    new SQLAlias('data__complaints'),
                ),
            )
                .from(EmailRecipient.table)
                .where('emailId', emailId);

            const result = await query.fetch();
            if (result.length !== 1) {
                console.error('Unexpected result', result);
                return;
            }
            const row = result[0]['data'];
            if (!row) {
                console.error('Unexpected result row', result);
                return;
            }

            const hardBounces = row['hardBounces'];
            const softBounces = row['softBounces'];
            const complaints = row['complaints'];

            if (typeof hardBounces !== 'number' || typeof softBounces !== 'number' || typeof complaints !== 'number') {
                console.error('Unexpected result values', row);
                return;
            }

            console.log('Updating email notification counts', emailId, hardBounces, softBounces, complaints);

            // Send an update query
            await Email.update()
                .where('id', emailId)
                .set('hardBouncesCount', hardBounces)
                .set('softBouncesCount', softBounces)
                .set('spamComplaintsCount', complaints)
                .update();
        });
    }

    async queueForSending(waitForSending = false) {
        console.log('Queueing email for sending', this.id);
        this.throwIfNotReadyToSend();
        this.throwIfNoUnsubscribeButton();
        await this.lock(async (upToDate) => {
            if (upToDate.status === EmailStatus.Draft) {
                upToDate.status = EmailStatus.Queued;
            }
            if (upToDate.status === EmailStatus.Failed) {
                // Retry failed email
                upToDate.status = EmailStatus.Queued;
            }
            await upToDate.save();
        });
        if (waitForSending) {
            return await this.resumeSending();
        }
        else {
            this.resumeSending().catch(console.error);
        }
        return this;
    }

    private async loadAttachments(): Promise<Attachment[]> {
        const attachments: Attachment[] = [];
        for (const attachment of this.attachments) {
            if (!attachment.content && !attachment.file) {
                console.warn('Attachment without content found, skipping', attachment);
                continue;
            }

            let filename = $t('b1291584-d2ad-4ebd-88ed-cbda4f3755b4');

            if (attachment.contentType === 'application/pdf') {
                // tmp solution for pdf only
                filename += '.pdf';
            }

            if (attachment.file?.name) {
                filename = attachment.file.name.toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/^-+/, '').replace(/-+$/, '');
            }

            // Correct file name if needed
            if (attachment.filename) {
                filename = attachment.filename.toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/^-+/, '').replace(/-+$/, '');
            }

            if (attachment.content) {
                attachments.push({
                    filename: filename,
                    content: attachment.content,
                    contentType: attachment.contentType ?? undefined,
                    encoding: 'base64',
                });
            }
            else {
                // Note: because we send lots of emails, we better download the file here so we can reuse it in every email instead of downloading it every time
                const withSigned = await attachment.file!.withSignedUrl();
                if (!withSigned || !withSigned.signedUrl) {
                    throw new SimpleError({
                        code: 'attachment_not_found',
                        message: 'Attachment not found',
                        human: $t(`ce6ddaf0-8347-42c5-b4b7-fbe860c7b7f2`),
                    });
                }

                const filePath = withSigned.signedUrl;
                let fileBuffer: Buffer | null = null;
                try {
                    const response = await fetch(filePath);
                    fileBuffer = Buffer.from(await response.arrayBuffer());
                }
                catch (e) {
                    throw new SimpleError({
                        code: 'attachment_not_found',
                        message: 'Attachment not found',
                        human: $t(`ce6ddaf0-8347-42c5-b4b7-fbe860c7b7f2`),
                    });
                }

                attachments.push({
                    filename: filename,
                    contentType: attachment.contentType ?? undefined,
                    content: fileBuffer,
                });
            }
        }
        return attachments;
    }

    private async sendSingleRecipient(recipient: EmailRecipient, organization: Organization | null, data: { from: EmailInterfaceRecipient; replyTo: EmailInterfaceRecipient | null; attachments: Attachment[] }) {
        let promiseResolve: (value: void | PromiseLike<void>) => void;
        const promise = new Promise<void>((resolve) => {
            promiseResolve = resolve;
        });

        const virtualRecipient = recipient.getRecipient();

        let resolved = false;
        const callback = async (error: Error | null) => {
            if (resolved) {
                return;
            }
            resolved = true;

            try {
                if (error === null) {
                    // Mark saved
                    recipient.sentAt = new Date();
                    recipient.failErrorMessage = null;

                    if (recipient.failError) {
                        recipient.previousFailError = recipient.failError;
                    }
                    recipient.failError = null;

                    // Update repacements that have been generated
                    recipient.replacements = virtualRecipient.replacements;
                    await recipient.save();
                }
                else {
                    recipient.failCount += 1;
                    recipient.failErrorMessage = error.message;
                    if (recipient.failError) {
                        recipient.previousFailError = recipient.failError;
                    }
                    recipient.failError = errorToSimpleErrors(error);
                    recipient.firstFailedAt = recipient.firstFailedAt ?? new Date();
                    recipient.lastFailedAt = new Date();
                    await recipient.save();
                }
            }
            catch (e) {
                console.error(e);
            }
            promiseResolve();
        };

        // Do send the email
        // Create e-mail builder
        const builder = await getEmailBuilder(organization ?? null, {
            recipients: [
                virtualRecipient,
            ],
            from: data.from,
            replyTo: data.replyTo,
            subject: this.subject!,
            html: this.html!,
            type: this.emailType ? 'transactional' : 'broadcast',
            attachments: data.attachments,
            callback(error: Error | null) {
                callback(error).catch(console.error);
            },
            headers: {
                'X-Email-Id': this.id,
                'X-Email-Recipient-Id': recipient.id,
            },
        });
        EmailClass.schedule(builder);
        return await promise;
    }

    async resumeSending(singleRecipientId: string | null = null): Promise<Email | null> {
        const id = this.id;
        return await QueueHandler.schedule('send-email', async ({ abort }) => {
            return await this.lock(async function (upToDate: Email) {
                if (upToDate.status === EmailStatus.Sent) {
                    // Already done
                    // In other cases -> queue has stopped and we can retry
                    if (!singleRecipientId) {
                        console.log('Email already sent, skipping...', upToDate.id);
                        return upToDate;
                    }
                }
                else {
                    if (singleRecipientId) {
                        // Not possible
                        throw new SimpleError({
                            code: 'invalid_state',
                            message: 'Cannot retry single recipient for email that is not yet sent',
                        });
                    }

                    if (upToDate.status === EmailStatus.Sending) {
                    // This is an automatic retry.
                        if (upToDate.emailType) {
                        // Not eligible for retry
                            upToDate.status = EmailStatus.Failed;
                            await upToDate.save();
                            return upToDate;
                        }
                        if (upToDate.createdAt < new Date(new Date().getTime() - 1000 * 60 * 60 * 24 * 2)) {
                        // Too long
                            console.error('Email has been sending for too long. Marking as failed...', upToDate.id);
                            upToDate.status = EmailStatus.Failed;
                            await upToDate.save();
                            return upToDate;
                        }
                    }
                    else if (upToDate.status !== EmailStatus.Queued) {
                        console.error('Email is not queued or sending, cannot send', upToDate.id, upToDate.status);
                        return upToDate;
                    }
                }

                const organization = upToDate.organizationId ? await Organization.getByID(upToDate.organizationId) : null;
                let from = upToDate.getDefaultFromAddress(organization);
                let replyTo: EmailInterfaceRecipient | null = upToDate.getFromAddress();
                let succeededCount = 0;
                let softFailedCount = 0;
                let failedCount = 0;

                try {
                    upToDate.throwIfNotReadyToSend();
                    upToDate.throwIfNoUnsubscribeButton();

                    if (!from) {
                        throw new SimpleError({
                            code: 'invalid_field',
                            message: 'Missing from',
                            human: $t(`e92cd077-b0f1-4b0a-82a0-8a8baa82e73a`),
                        });
                    }

                    // Can we send from this e-mail or reply-to?
                    if (upToDate.fromAddress && await canSendFromEmail(upToDate.fromAddress, organization ?? null)) {
                        from = upToDate.getFromAddress();
                        replyTo = null;
                    }

                    abort.throwIfAborted();

                    if (!singleRecipientId) {
                        upToDate.status = EmailStatus.Sending;
                    }
                    upToDate.sentAt = upToDate.sentAt ?? new Date();
                    await upToDate.save();

                    // Create recipients if not yet created
                    await upToDate.buildRecipients();
                    abort.throwIfAborted();

                    // Refresh model
                    const c = (await Email.getByID(id))!;
                    if (!c) {
                        throw new SimpleError({
                            code: 'not_found',
                            message: 'Email not found',
                            human: $t(`55899a7c-f3d4-43fe-a431-70a3a9e78e34`),
                        });
                    }
                    upToDate.copyFrom(c);

                    if (upToDate.recipientsStatus !== EmailRecipientsStatus.Created) {
                        throw new SimpleError({
                            code: 'recipients_not_created',
                            message: 'Failed to create recipients',
                            human: $t(`f660b2eb-e382-4d21-86e4-673ca7bc2d4a`),
                        });
                    }

                    // Create a buffer of all attachments
                    if (upToDate.sendAsEmail === true) {
                        const attachments = await upToDate.loadAttachments();

                        // Start actually sending in batches of recipients that are not yet sent
                        let idPointer = '';
                        const batchSize = 100;
                        let isSavingStatus = false;
                        let lastStatusSave = new Date();

                        async function saveStatus() {
                            if (singleRecipientId) {
                                // Don't save during looping
                                return;
                            }

                            if (!upToDate) {
                                return;
                            }
                            if (isSavingStatus) {
                                return;
                            }
                            if ((new Date().getTime() - lastStatusSave.getTime()) < 1000 * 5) {
                            // Save at most every 5 seconds
                                return;
                            }
                            if (succeededCount < upToDate.succeededCount || softFailedCount < upToDate.softFailedCount || failedCount < upToDate.failedCount) {
                            // Do not update on retries
                                return;
                            }

                            lastStatusSave = new Date();
                            isSavingStatus = true;
                            upToDate.succeededCount = succeededCount;
                            upToDate.softFailedCount = softFailedCount;
                            upToDate.failedCount = failedCount;

                            try {
                                await upToDate.save();
                            }
                            finally {
                                isSavingStatus = false;
                            }
                        }

                        while (true) {
                            abort.throwIfAborted();
                            const data = await SQL.select()
                                .from('email_recipients')
                                .where('emailId', upToDate.id)
                                .where('id', SQLWhereSign.Greater, idPointer)
                                .orderBy(SQL.column('id'), 'ASC')
                                .limit(batchSize)
                                .fetch();

                            const recipients = EmailRecipient.fromRows(data, 'email_recipients');

                            if (recipients.length === 0) {
                                break;
                            }

                            const sendingPromises: Promise<void>[] = [];
                            let skipped = 0;

                            for (const recipient of recipients) {
                                idPointer = recipient.id;

                                if (recipient.sentAt) {
                                    succeededCount += 1;
                                    await saveStatus();
                                    skipped++;
                                    continue;
                                }

                                if (!recipient.email) {
                                    skipped++;
                                    continue;
                                }

                                if (recipient.duplicateOfRecipientId) {
                                    skipped++;
                                    continue;
                                }

                                if (singleRecipientId) {
                                    if (recipient.id !== singleRecipientId) {
                                        // Failed or soft-failed
                                        if (recipient.failError && isSoftEmailRecipientError(recipient.failError)) {
                                            softFailedCount += 1;
                                        }
                                        else {
                                            failedCount += 1;
                                        }
                                        skipped++;
                                        await saveStatus();
                                        continue;
                                    }
                                }

                                const promise = upToDate.sendSingleRecipient(recipient, organization ?? null, {
                                    from,
                                    replyTo,
                                    attachments,
                                });
                                sendingPromises.push(promise.then(async () => {
                                    if (recipient.sentAt) {
                                        succeededCount += 1;
                                        await saveStatus();
                                    }
                                    else {
                                        // Failed or soft-failed
                                        if (recipient.failError && isSoftEmailRecipientError(recipient.failError)) {
                                            softFailedCount += 1;
                                        }
                                        else {
                                            failedCount += 1;
                                        }
                                        await saveStatus();
                                    }
                                }));
                            }

                            if (sendingPromises.length > 0 || skipped > 0) {
                                await Promise.all(sendingPromises);
                            }
                            else {
                                break;
                            }
                        }
                    }
                }
                catch (e) {
                    if (!upToDate) {
                        throw e;
                    }

                    if (!singleRecipientId) {
                        upToDate.succeededCount = succeededCount;
                        upToDate.softFailedCount = softFailedCount;
                        upToDate.failedCount = failedCount;

                        if (isAbortedError(e) || ((isSimpleError(e) || isSimpleErrors(e)) && e.hasCode('SHUTDOWN'))) {
                            // Keep sending status: we'll resume after the reboot
                            await upToDate.save();
                            throw e;
                        }

                        upToDate.emailErrors = errorToSimpleErrors(e);
                        upToDate.status = EmailStatus.Failed;
                        await upToDate.save();
                    }
                    throw e;
                }

                if (!singleRecipientId) {
                    if (upToDate.sendAsEmail && upToDate.emailRecipientsCount === 0 && upToDate.userId === null) {
                        // We only delete automated emails (email type) if they have no recipients
                        console.log('No recipients found for email ', upToDate.id, ' deleting...');
                        await upToDate.delete();
                        return null;
                    }

                    console.log('Finished sending email', upToDate.id);
                    // Mark email as sent

                    if (upToDate.sendAsEmail && !upToDate.showInMemberPortal && (succeededCount + failedCount + softFailedCount) === 0) {
                        upToDate.status = EmailStatus.Failed;
                        upToDate.emailErrors = new SimpleErrors(
                            new SimpleError({
                                code: 'no_recipients',
                                message: 'No recipients',
                                human: $t(`9fe3de8e-090c-4949-97da-4810ce9e61c7`),
                            }),
                        );
                    }
                    else {
                        upToDate.status = EmailStatus.Sent;
                        upToDate.emailErrors = null;
                    }
                }

                upToDate.succeededCount = succeededCount;
                upToDate.softFailedCount = softFailedCount;
                upToDate.failedCount = failedCount;

                await upToDate.save();
                return upToDate;
            });
        });
    }

    async updateCount() {
        // First reset
        const id = this.id;

        await QueueHandler.schedule('email-count-' + this.id, async function () {
            const upToDate = await Email.getByID(id);

            if (!upToDate || upToDate.sentAt || !upToDate.id || upToDate.status !== EmailStatus.Draft) {
                return;
            }

            if (upToDate.recipientsStatus === EmailRecipientsStatus.Created) {
                return;
            }

            upToDate.emailRecipientsCount = null;
            upToDate.recipientsErrors = null;
            await upToDate.save();
        });
        await this.refresh();

        QueueHandler.abort('email-count-' + this.id);
        QueueHandler.schedule('email-count-' + this.id, async function ({ abort }) {
            let upToDate = await Email.getByID(id);

            if (!upToDate || upToDate.sentAt || !upToDate.id || upToDate.status !== EmailStatus.Draft) {
                return;
            }

            if (upToDate.recipientsStatus === EmailRecipientsStatus.Created) {
                return;
            }

            let count = 0;

            try {
                for (const subfilter of upToDate.recipientFilter.filters) {
                    // Create recipients
                    const loader = Email.recipientLoaders.get(subfilter.type);

                    if (!loader) {
                        throw new Error('Loader for type ' + subfilter.type + ' has not been initialised on the Email model');
                    }

                    const request = new LimitedFilteredRequest({
                        filter: subfilter.filter,
                        sort: [{ key: 'id', order: SortItemDirection.ASC }],
                        limit: 1,
                        search: subfilter.search,
                    });

                    abort.throwIfAborted();
                    const c = await loader.count(request, subfilter.subfilter);

                    count += c;
                }
                abort.throwIfAborted();

                // Check if we have a more reliable emailRecipientsCount in the meantime
                upToDate = await Email.getByID(id);

                if (!upToDate) {
                    return;
                }
                if (upToDate.recipientsStatus === EmailRecipientsStatus.Created) {
                    return;
                }
                upToDate.emailRecipientsCount = count;
                upToDate.recipientsErrors = null;
                await upToDate.save();
            }
            catch (e) {
                if (isAbortedError(e)) {
                    return;
                }
                console.error('Failed to update count for email', id);
                console.error(e);

                // Check if we have a more reliable emailRecipientsCount in the meantime
                upToDate = await Email.getByID(id);

                if (!upToDate) {
                    return;
                }
                if (upToDate.recipientsStatus === EmailRecipientsStatus.Created) {
                    return;
                }
                upToDate.recipientsErrors = errorToSimpleErrors(e);
                upToDate.emailRecipientsCount = null;
                await upToDate.save();
            }
        }).catch(console.error);
    }

    async buildRecipients() {
        const id = this.id;
        await QueueHandler.schedule('email-build-recipients-' + this.id, async function ({ abort }) {
            const upToDate = await Email.getByID(id);

            if (!upToDate || !upToDate.id) {
                return;
            }

            if (upToDate.recipientsStatus === EmailRecipientsStatus.Created) {
                return;
            }

            if (upToDate.status === EmailStatus.Sent) {
                return;
            }

            abort.throwIfAborted();
            const organization = upToDate.organizationId ? (await Organization.getByID(upToDate.organizationId) ?? null) : null;
            if (upToDate.organizationId && !organization) {
                throw new SimpleError({
                    code: 'organization_not_found',
                    message: 'Organization not found',
                    human: $t(`f3c6e2b1-2f3a-4e2f-8f7a-1e5f3d3c8e2a`),
                });
            }
            const platform = await Platform.getSharedPrivateStruct();

            console.log('Building recipients for email', id);

            // If it is already creating -> something went wrong (e.g. server restart) and we can safely try again

            upToDate.recipientsStatus = EmailRecipientsStatus.Creating;
            await upToDate.save();

            const membersSet = new Set<string>();
            const emailsSet = new Set<string>();

            let count = 0;
            let countWithoutEmail = 0;

            try {
                // Delete all recipients
                await SQL
                    .delete()
                    .from(
                        SQL.table('email_recipients'),
                    )
                    .where(SQL.column('emailId'), upToDate.id);

                abort.throwIfAborted();

                for (const subfilter of upToDate.recipientFilter.filters) {
                    // Create recipients
                    const loader = Email.recipientLoaders.get(subfilter.type);

                    if (!loader) {
                        throw new Error('Loader for type ' + subfilter.type + ' has not been initialised on the Email model');
                    }

                    let request: LimitedFilteredRequest | null = new LimitedFilteredRequest({
                        filter: subfilter.filter,
                        sort: [{ key: 'id', order: SortItemDirection.ASC }],
                        limit: 100,
                        search: subfilter.search,
                    });

                    const beforeFetchAllResult = loader.beforeFetchAll ? await loader.beforeFetchAll(request, subfilter.subfilter) : undefined;

                    while (request) {
                        abort.throwIfAborted();
                        const response = await loader.fetch(request, subfilter.subfilter, beforeFetchAllResult);

                        for (const item of response.results) {
                            if (!item.email && !item.memberId && !item.userId) {
                                continue;
                            }

                            const recipient = new EmailRecipient();
                            recipient.emailType = upToDate.emailType;
                            recipient.objectId = item.objectId;
                            recipient.emailId = upToDate.id;
                            recipient.email = item.email;
                            recipient.firstName = item.firstName;
                            recipient.lastName = item.lastName;
                            recipient.replacements = item.replacements;
                            recipient.memberId = item.memberId ?? null;
                            recipient.userId = item.userId ?? null;
                            recipient.organizationId = upToDate.organizationId ?? null;

                            await fillRecipientReplacements(recipient, {
                                platform,
                                organization,
                                from: upToDate.getFromAddress(),
                                replyTo: null,
                                forPreview: false,
                            });
                            recipient.replacements = removeUnusedReplacements(upToDate.html ?? '', recipient.replacements);

                            let duplicateOfRecipientId: string | null = null;
                            if (item.email && emailsSet.has(item.email)) {
                                console.log('Found duplicate email recipient', item.email);

                                // Try to merge
                                const existing = await EmailRecipient.select()
                                    .where('emailId', upToDate.id)
                                    .where('email', item.email)
                                    .where('duplicateOfRecipientId', null)
                                    .fetch();

                                for (const other of existing) {
                                    const merged = mergeReplacementsIfEqual(other.replacements, recipient.replacements);
                                    if (merged !== false) {
                                        console.log('Found mergeable duplicate email recipient', item.email, other.id);
                                        duplicateOfRecipientId = other.id;

                                        other.replacements = merged;
                                        other.firstName = other.firstName || item.firstName;
                                        other.lastName = other.lastName || item.lastName;
                                        await other.save();

                                        recipient.replacements = merged;

                                        break;
                                    }
                                    else {
                                        console.log('Could not merge duplicate email recipient', item.email, other.id, 'keeping both', other.replacements, item.replacements);
                                    }
                                }
                            }
                            recipient.duplicateOfRecipientId = duplicateOfRecipientId;

                            await recipient.save();

                            if (recipient.memberId) {
                                membersSet.add(recipient.memberId);
                            }

                            if (recipient.email) {
                                emailsSet.add(recipient.email);
                            }

                            if (!recipient.email || duplicateOfRecipientId) {
                                countWithoutEmail += 1;
                            }
                            else {
                                count += 1;
                            }
                        }

                        request = response.next ?? null;
                    }
                }

                upToDate.recipientsStatus = EmailRecipientsStatus.Created;
                upToDate.emailRecipientsCount = count;
                upToDate.otherRecipientsCount = countWithoutEmail;
                upToDate.recipientsErrors = null;
                upToDate.membersCount = membersSet.size;
                await upToDate.save();
            }
            catch (e: unknown) {
                console.error('Failed to build recipients for email', id);
                console.error(e);
                upToDate.recipientsStatus = EmailRecipientsStatus.NotCreated;
                upToDate.recipientsErrors = errorToSimpleErrors(e);
                await upToDate.save();
            }
        });
    }

    async buildExampleRecipient(isNewlyCreated = false) {
        const id = this.id;
        await QueueHandler.schedule('email-build-recipients-' + this.id, async function () {
            const upToDate = await Email.getByID(id);

            if (!upToDate || upToDate.sentAt || !upToDate.id) {
                return;
            }

            if (upToDate.recipientsStatus !== EmailRecipientsStatus.NotCreated) {
                return;
            }

            try {
                // Delete all recipients
                if (!isNewlyCreated) {
                    await SQL
                        .delete()
                        .from(
                            SQL.table('email_recipients'),
                        )
                        .where(SQL.column('emailId'), upToDate.id);
                }

                for (const subfilter of upToDate.recipientFilter.filters) {
                    // Create recipients
                    const loader = Email.recipientLoaders.get(subfilter.type);

                    if (!loader) {
                        throw new Error('Loader for type ' + subfilter.type + ' has not been initialised on the Email model');
                    }

                    let request: LimitedFilteredRequest | null = new LimitedFilteredRequest({
                        filter: subfilter.filter,
                        sort: [{ key: 'id', order: SortItemDirection.ASC }],
                        limit: 10,
                        search: subfilter.search,
                    });

                    const beforeFetchAllResult = loader.beforeFetchAll ? await loader.beforeFetchAll(request, subfilter.subfilter) : undefined;

                    while (request) {
                        const response = await loader.fetch(request, subfilter.subfilter, beforeFetchAllResult);

                        // Note: it is possible that a result in the database doesn't return a recipient (in memory filtering)
                        // so we do need pagination

                        for (const item of response.results) {
                            const recipient = new EmailRecipient();
                            recipient.emailType = upToDate.emailType;
                            recipient.emailId = upToDate.id;
                            recipient.objectId = item.objectId;
                            recipient.email = item.email;
                            recipient.firstName = item.firstName;
                            recipient.lastName = item.lastName;
                            recipient.replacements = item.replacements;
                            recipient.memberId = item.memberId ?? null;
                            recipient.userId = item.userId ?? null;
                            recipient.organizationId = upToDate.organizationId ?? null;
                            await recipient.save();

                            if (recipient.email || recipient.userId) {
                                return;
                            }
                        }

                        request = null;
                    }
                }

                console.warn('No example recipient found for email', id);
            }
            catch (e) {
                console.error('Failed to build example recipient for email', id);
                console.error(e);
            }
        });
    }

    getStructure() {
        return EmailStruct.create(this);
    }

    async getPreviewStructure() {
        const emailRecipient = await EmailRecipient.select()
            .where('emailId', this.id)
            .where('email', '!=', null)
            .first(false);

        let recipientRow: EmailRecipientStruct | undefined;

        if (emailRecipient) {
            recipientRow = await emailRecipient.getStructure();
        }

        if (!recipientRow) {
            recipientRow = getExampleRecipient();
        }

        const virtualRecipient = recipientRow.getRecipient();
        const organization = this.organizationId ? (await Organization.getByID(this.organizationId))! : null;

        await fillRecipientReplacements(virtualRecipient, {
            organization,
            from: this.getFromAddress(),
            replyTo: null,
            forPreview: true,
            forceRefresh: !this.sentAt,
        });
        recipientRow.replacements = virtualRecipient.replacements;

        let user: UserStruct | null = null;
        if (this.userId) {
            const u = await User.getByID(this.userId);
            if (u) {
                user = u.getStructure();
            }
        }

        let organizationStruct: BaseOrganization | null = null;
        if (organization) {
            organizationStruct = organization.getBaseStructure();
        }

        return EmailPreview.create({
            ...this,
            user,
            organization: organizationStruct,
            exampleRecipient: recipientRow,
        });
    }

    async getStructureForUser(user: User, memberIds: string[]) {
        const emailRecipients = await EmailRecipient.select()
            .where('emailId', this.id)
            .where('memberId', memberIds)
            .fetch();
        const organization = this.organizationId ? (await Organization.getByID(this.organizationId))! : null;

        const recipientsMap: Map<string, EmailRecipient> = new Map();
        for (const memberId of memberIds) {
            const preferred = emailRecipients.find(e => e.memberId === memberId && (e.userId === user.id || e.email === user.email));
            if (preferred) {
                recipientsMap.set(preferred.duplicateOfRecipientId ?? preferred.id, preferred);
                continue;
            }

            const byMember = emailRecipients.find(e => e.memberId === memberId && e.userId === null && e.email === null);
            if (byMember) {
                recipientsMap.set(byMember.duplicateOfRecipientId ?? byMember.id, byMember);
                continue;
            }
            const anyData = emailRecipients.find(e => e.memberId === memberId);
            if (anyData) {
                recipientsMap.set(anyData.duplicateOfRecipientId ?? anyData.id, anyData);
                continue;
            }
        }

        // Remove duplicates that are marked as the same recipient
        const cleanedRecipients: EmailRecipient[] = [...recipientsMap.values()];
        const structures = await EmailRecipient.getStructures(cleanedRecipients);

        for (const struct of structures) {
            if (!(struct.userId === user.id || struct.email === user.email) && !((struct.userId === null && struct.email === null))) {
                stripSensitiveRecipientReplacements(struct, {
                    organization,
                    willFill: true,
                });
            }

            struct.firstName = user.firstName;
            struct.lastName = user.lastName;
            struct.email = user.email;
            struct.userId = user.id;

            // We always refresh the data when we display it on the web (so everything is up to date)
            await fillRecipientReplacements(struct, {
                organization,
                from: this.getFromAddress(),
                replyTo: null,
                forPreview: false,
                forceRefresh: true,
            });
            stripRecipientReplacementsForWebDisplay(struct, {
                organization,
            });
            if (this.html) {
                struct.replacements = removeUnusedReplacements(this.html, struct.replacements);
            }
        }

        // Loop structures and remove if they have exactly the same content
        // We do this here, because it is possible the user didn't receive any emails, so
        // the merging at time of sending the emails didn't happen (uniqueness happened on email)
        const uniqueStructures: EmailRecipientStruct[] = [];
        for (const struct of structures) {
            let found = false;
            for (const unique of uniqueStructures) {
                const merged = mergeReplacementsIfEqual(unique.replacements, struct.replacements);
                if (merged !== false) {
                    unique.replacements = merged;
                    found = true;
                    break;
                }
            }

            if (!found) {
                uniqueStructures.push(struct);
            }
        }

        let organizationStruct: BaseOrganization | null = null;
        if (organization) {
            organizationStruct = organization.getBaseStructure();
        }

        return EmailWithRecipients.create({
            ...this,
            organization: organizationStruct,
            recipients: uniqueStructures,

            // Remove private-like data
            softBouncesCount: 0,
            failedCount: 0,
            emailErrors: null,
            recipientsErrors: null,
            succeededCount: 1,
            emailRecipientsCount: 1,
            hardBouncesCount: 0,
            spamComplaintsCount: 0,
            recipientFilter: EmailRecipientFilter.create({}),
            membersCount: 1,
            otherRecipientsCount: 0,
        });
    }
}
