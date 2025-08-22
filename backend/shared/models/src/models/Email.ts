import { column } from '@simonbackx/simple-database';
import { EmailAttachment, EmailPreview, EmailRecipientFilter, EmailRecipientFilterType, EmailRecipientsStatus, EmailRecipient as EmailRecipientStruct, EmailStatus, Email as EmailStruct, EmailTemplateType, getExampleRecipient, LimitedFilteredRequest, PaginatedResponse, SortItemDirection, StamhoofdFilter } from '@stamhoofd/structures';
import { v4 as uuidv4 } from 'uuid';

import { AnyDecoder, ArrayDecoder } from '@simonbackx/simple-encoding';
import { isSimpleError, isSimpleErrors, SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { I18n } from '@stamhoofd/backend-i18n';
import { Email as EmailClass, EmailInterfaceRecipient } from '@stamhoofd/email';
import { isAbortedError, QueueHandler } from '@stamhoofd/queues';
import { QueryableModel, SQL, SQLWhereSign } from '@stamhoofd/sql';
import { canSendFromEmail, fillRecipientReplacements, getEmailBuilder } from '../helpers/EmailBuilder';
import { EmailRecipient } from './EmailRecipient';
import { EmailTemplate } from './EmailTemplate';
import { Organization } from './Organization';

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
                human: $t(`Onbekende fout`),
            }),
        );
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

    @column({ type: 'integer', nullable: true })
    recipientCount: number | null = null;

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

    static recipientLoaders: Map<EmailRecipientFilterType, {
        fetch(request: LimitedFilteredRequest, subfilter: StamhoofdFilter | null): Promise<PaginatedResponse<EmailRecipientStruct[], LimitedFilteredRequest>>;
        count(request: LimitedFilteredRequest, subfilter: StamhoofdFilter | null): Promise<number>;
    }> = new Map();

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

        if (this.recipientsErrors !== null && this.recipientsStatus !== EmailRecipientsStatus.Created) {
            throw new SimpleError({
                code: 'invalid_recipients',
                message: 'Failed to build recipients (count)',
                human: $t(`Er ging iets mis bij het aanmaken van de ontvangers. Probeer je selectie aan te passen. Neem contact op als het probleem zich blijft voordoen.`) + ' ' + this.recipientsErrors.getHuman(),
            });
        }

        this.validateAttachments();
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

    async send(): Promise<Email | null> {
        this.throwIfNotReadyToSend();
        const id = this.id;
        return await QueueHandler.schedule('send-email', async function (this: unknown, { abort }) {
            let upToDate = await Email.getByID(id);
            if (!upToDate) {
                throw new SimpleError({
                    code: 'not_found',
                    message: 'Email not found',
                    human: $t(`55899a7c-f3d4-43fe-a431-70a3a9e78e34`),
                });
            }
            if (upToDate.status === EmailStatus.Sent) {
                // Already done
                // In other cases -> queue has stopped and we can retry
                return upToDate;
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
            const organization = upToDate.organizationId ? await Organization.getByID(upToDate.organizationId) : null;
            let from = upToDate.getDefaultFromAddress(organization);
            let replyTo: EmailInterfaceRecipient | null = upToDate.getFromAddress();
            const attachments: { filename: string; path?: string; href?: string; content?: string | Buffer; contentType?: string; encoding?: string }[] = [];
            let succeededCount = 0;
            let softFailedCount = 0;
            let failedCount = 0;

            try {
                upToDate.throwIfNotReadyToSend();

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
                upToDate.status = EmailStatus.Sending;
                upToDate.sentAt = upToDate.sentAt ?? new Date();
                await upToDate.save();

                // Create recipients if not yet created
                await upToDate.buildRecipients();
                abort.throwIfAborted();

                // Refresh model
                upToDate = await Email.getByID(id);
                if (!upToDate) {
                    throw new SimpleError({
                        code: 'not_found',
                        message: 'Email not found',
                        human: $t(`55899a7c-f3d4-43fe-a431-70a3a9e78e34`),
                    });
                }

                if (upToDate.recipientsStatus !== EmailRecipientsStatus.Created) {
                    throw new SimpleError({
                        code: 'recipients_not_created',
                        message: 'Failed to create recipients',
                        human: $t(`f660b2eb-e382-4d21-86e4-673ca7bc2d4a`),
                    });
                }

                // Create a buffer of all attachments
                for (const attachment of upToDate.attachments) {
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

                // Start actually sending in batches of recipients that are not yet sent
                let idPointer = '';
                const batchSize = 100;
                const recipientsSet = new Set<string>();
                let isSavingStatus = false;
                let lastStatusSave = new Date();

                async function saveStatus() {
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
                        if (recipientsSet.has(recipient.id)) {
                            console.error('Found duplicate recipient while sending email', recipient.id);
                            softFailedCount += 1;

                            recipient.failCount += 1;
                            recipient.failErrorMessage = 'Duplicate recipient';
                            recipient.failError = new SimpleErrors(
                                new SimpleError({
                                    code: 'email_skipped_duplicate_recipient',
                                    message: 'Duplicate recipient',
                                    human: $t('Dit e-mailadres staat meerdere keren tussen de ontvangers en werd daarom overgeslagen'),
                                }),
                            );

                            recipient.firstFailedAt = recipient.firstFailedAt ?? new Date();
                            recipient.lastFailedAt = new Date();
                            await recipient.save();

                            await saveStatus();
                            skipped++;
                            continue;
                        }
                        recipientsSet.add(recipient.email);

                        if (recipient.sentAt) {
                            // Already sent
                            succeededCount += 1;
                            await saveStatus();
                            skipped++;
                            continue;
                        }

                        idPointer = recipient.id;

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

                                    // Update repacements that have been generated
                                    recipient.replacements = virtualRecipient.replacements;

                                    succeededCount += 1;
                                    await recipient.save();
                                    await saveStatus();
                                }
                                else {
                                    recipient.failCount += 1;
                                    recipient.failErrorMessage = error.message;
                                    recipient.failError = errorToSimpleErrors(error);
                                    recipient.firstFailedAt = recipient.firstFailedAt ?? new Date();
                                    recipient.lastFailedAt = new Date();

                                    if (isSoftEmailRecipientError(recipient.failError)) {
                                        softFailedCount += 1;
                                    }
                                    else {
                                        failedCount += 1;
                                    }
                                    await recipient.save();
                                    await saveStatus();
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
                            from,
                            replyTo,
                            subject: upToDate.subject!,
                            html: upToDate.html!,
                            type: upToDate.emailType ? 'transactional' : 'broadcast',
                            attachments,
                            callback(error: Error | null) {
                                callback(error).catch(console.error);
                            },
                        });
                        abort.throwIfAborted(); // do not schedule if aborted
                        EmailClass.schedule(builder);
                        sendingPromises.push(promise);
                    }

                    if (sendingPromises.length > 0 || skipped > 0) {
                        await Promise.all(sendingPromises);
                    }
                    else {
                        break;
                    }
                }
            }
            catch (e) {
                if (!upToDate) {
                    throw e;
                }

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
                throw e;
            }

            if (upToDate.recipientCount === 0 && upToDate.userId === null) {
                // We only delete automated emails (email type) if they have no recipients
                console.log('No recipients found for email ', upToDate.id, ' deleting...');
                await upToDate.delete();
                return null;
            }

            console.log('Finished sending email', upToDate.id);
            // Mark email as sent

            if ((succeededCount + failedCount + softFailedCount) === 0) {
                upToDate.status = EmailStatus.Failed;
                upToDate.emailErrors = new SimpleErrors(
                    new SimpleError({
                        code: 'no_recipients',
                        message: 'No recipients',
                        human: $t(`Geen ontvangers gevonden`),
                    }),
                );
            }
            else {
                upToDate.status = EmailStatus.Sent;
                upToDate.emailErrors = null;
            }

            upToDate.succeededCount = succeededCount;
            upToDate.softFailedCount = softFailedCount;
            upToDate.failedCount = failedCount;

            await upToDate.save();
            return upToDate;
        });
    }

    updateCount() {
        const id = this.id;
        QueueHandler.schedule('email-count-' + this.id, async function () {
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

                    const c = await loader.count(request, subfilter.subfilter);

                    count += c;
                }

                // Check if we have a more reliable recipientCount in the meantime
                upToDate = await Email.getByID(id);

                if (!upToDate) {
                    return;
                }
                if (upToDate.recipientsStatus === EmailRecipientsStatus.Created) {
                    return;
                }
                upToDate.recipientCount = count;
                await upToDate.save();
            }
            catch (e) {
                console.error('Failed to update count for email', id);
                console.error(e);

                // Check if we have a more reliable recipientCount in the meantime
                upToDate = await Email.getByID(id);

                if (!upToDate) {
                    return;
                }
                if (upToDate.recipientsStatus === EmailRecipientsStatus.Created) {
                    return;
                }
                upToDate.recipientsErrors = errorToSimpleErrors(e);
                await upToDate.save();
            }
        }).catch(console.error);
    }

    async invalidateRecipients() {
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

            // If it is already creating -> something went wrong (e.g. server restart) and we can safely try again
            upToDate.recipientsStatus = EmailRecipientsStatus.NotCreated;
            await upToDate.save();
        });
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

            // If it is already creating -> something went wrong (e.g. server restart) and we can safely try again

            upToDate.recipientsStatus = EmailRecipientsStatus.Creating;
            await upToDate.save();

            let count = 0;

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

                    while (request) {
                        abort.throwIfAborted();
                        const response = await loader.fetch(request, subfilter.subfilter);

                        for (const item of response.results) {
                            if (!item.email) {
                                continue;
                            }
                            count += 1;
                            const recipient = new EmailRecipient();
                            recipient.emailType = upToDate.emailType;
                            recipient.objectId = item.objectId;
                            recipient.emailId = upToDate.id;
                            recipient.email = item.email;
                            recipient.firstName = item.firstName;
                            recipient.lastName = item.lastName;
                            recipient.replacements = item.replacements;

                            await recipient.save();
                        }

                        request = response.next ?? null;
                    }
                }

                upToDate.recipientsStatus = EmailRecipientsStatus.Created;
                upToDate.recipientCount = count;
                upToDate.recipientsErrors = null;
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

    async buildExampleRecipient() {
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
                await SQL
                    .delete()
                    .from(
                        SQL.table('email_recipients'),
                    )
                    .where(SQL.column('emailId'), upToDate.id);

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

                    while (request) {
                        const response = await loader.fetch(request, subfilter.subfilter);

                        // Note: it is possible that a result in the database doesn't return a recipient (in memory filtering)
                        // so we do need pagination

                        for (const item of response.results) {
                            const recipient = new EmailRecipient();
                            recipient.emailId = upToDate.id;
                            recipient.email = item.email;
                            recipient.firstName = item.firstName;
                            recipient.lastName = item.lastName;
                            recipient.replacements = item.replacements;
                            await recipient.save();
                            return;
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
            .first(false);

        let recipientRow: EmailRecipientStruct | undefined;

        if (emailRecipient) {
            recipientRow = emailRecipient.getStructure();
        }

        if (!recipientRow) {
            recipientRow = getExampleRecipient();
        }

        const virtualRecipient = recipientRow.getRecipient();

        await fillRecipientReplacements(virtualRecipient, {
            organization: this.organizationId ? (await Organization.getByID(this.organizationId))! : null,
            from: this.getFromAddress(),
            replyTo: null,
        });

        recipientRow.replacements = virtualRecipient.replacements;

        return EmailPreview.create({
            ...this,
            exampleRecipient: recipientRow,
        });
    }
}
