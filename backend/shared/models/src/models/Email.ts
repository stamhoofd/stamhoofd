import { column } from '@simonbackx/simple-database';
import type { EmailRecipient as EmailRecipientStruct, EmailTemplateType, PaginatedResponse, StamhoofdFilter } from '@stamhoofd/structures';
import { EmailAttachment, EmailContent, EmailRecipientFilter, EmailRecipientsStatus, EmailStatus, Email as EmailStruct, LanguageHelper, LimitedFilteredRequest, SortItemDirection } from '@stamhoofd/structures';
import type { Country } from '@stamhoofd/types/Country';
import { Language } from '@stamhoofd/types/Language';
import { v4 as uuidv4 } from 'uuid';
import type { EmailRecipientFilterType } from '@stamhoofd/structures/email/EmailRecipientFilterType.js';
import type { Decoder } from '@simonbackx/simple-encoding';
import { AnyDecoder, ArrayDecoder, EnumDecoder, MapDecoder } from '@simonbackx/simple-encoding';
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { I18n } from '@stamhoofd/backend-i18n/I18n';
import type { EmailInterfaceRecipient } from '@stamhoofd/email';
import type { QueueHandlerOptions } from '@stamhoofd/queues';
import { isAbortedError, QueueHandler } from '@stamhoofd/queues';
import { QueryableModel, readDynamicSQLExpression, SQL, SQLAlias, SQLCount, SQLSelectAs } from '@stamhoofd/sql';
import { errorToSimpleErrors } from '../helpers/errorToSimpleErrors.js';
import { EmailRecipient } from './EmailRecipient.js';
import { EmailTemplate } from './EmailTemplate.js';
import { Organization } from './Organization.js';

export type RecipientLoader<BeforeFetchAllResult = any> = {
    /**
     * Run one or multiple queries before fetching all recipients.
     * The result of this function will be passed to the `fetch` function.
     */
    beforeFetchAll?: (request: LimitedFilteredRequest, subfilter: StamhoofdFilter | null) => Promise<BeforeFetchAllResult>;
    fetch(request: LimitedFilteredRequest, subfilter: StamhoofdFilter | null, beforeFetchAllResult?: BeforeFetchAllResult, options?: { allowedLanguages?: Language[] | null }): Promise<PaginatedResponse<EmailRecipientStruct[], LimitedFilteredRequest>>;
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

    /** Full content overrides per language. The default content (subject/html/text/json) is used for all recipients without a matching override. Never contains `language` itself */
    @column({ type: 'json', decoder: new MapDecoder(new EnumDecoder(Language), EmailContent as Decoder<EmailContent>) })
    translations: Map<Language, EmailContent> = new Map();

    /** The language of the default content (subject/html/text/json); null when the content is untranslated */
    @column({ type: 'string', nullable: true })
    language: Language | null = null;

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
                human: $t(`%wu`),
            });
        }

        if (this.text == null || this.text.length == 0) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Missing text',
                human: $t(`%wv`),
            });
        }

        if (this.html == null || this.html.length == 0) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Missing html',
                human: $t(`%wv`),
            });
        }

        for (const [language, content] of this.translations) {
            if (content.subject.length === 0 || content.text.length === 0 || content.html.length === 0) {
                throw new SimpleError({
                    code: 'invalid_field',
                    message: 'Missing subject, text or html in translation ' + language,
                    human: $t('%Ze9', { language: LanguageHelper.getName(language) }),
                });
            }
        }

        if (this.fromAddress == null || this.fromAddress.length == 0) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Missing from',
                human: $t(`%ww`),
            });
        }

        if (this.status === EmailStatus.Draft && this.recipientsErrors !== null && this.recipientsStatus !== EmailRecipientsStatus.Created) {
            throw new SimpleError({
                code: 'invalid_recipients',
                message: 'Failed to build recipients (count)',
                human: $t(`%1EE`) + ' ' + this.recipientsErrors.getHuman(),
            });
        }

        if (this.deletedAt) {
            throw new SimpleError({
                code: 'invalid_state',
                message: 'Email is deleted',
                human: $t(`%1EF`),
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
                    human: $t(`%DS`),
                    field: 'html',
                });
            }
        }

        for (const [language, content] of this.translations) {
            if ((content.html && !content.html.includes(replacement)) || (content.text && !content.text.includes(replacement))) {
                throw new SimpleError({
                    code: 'missing_unsubscribe_button',
                    message: 'Missing unsubscribe button in translation ' + language,
                    human: $t(`%DS`),
                    field: 'translations',
                });
            }
        }

        if (this.text) {
            // Check email contains an unsubscribe button
            if (!this.text.includes(replacement)) {
                throw new SimpleError({
                    code: 'missing_unsubscribe_button',
                    message: 'Missing unsubscribe button',
                    human: $t(`%DS`),
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
                human: $t(`%wx`),
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
                    human: $t(`%wy`),
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

        if (this.language !== null && this.language !== defaultTemplate.language) {
            const content = defaultTemplate.translations.get(this.language);
            if (content) {
                this.html = content.html;
                this.text = content.text;
                this.subject = content.subject;
                this.json = content.json;
            }
        }

        return true;
    }

    /**
     * The html of all languages combined - only used to check which replacements are in use.
     */
    getCombinedHtml(): string {
        return [this.html ?? '', ...[...this.translations.values()].map(content => content.html)].join(' ');
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
                    human: $t(`%wz`),
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
                base.set('hardBouncesCount',
                    SQL.calculation(SQL.column('hardBouncesCount'))
                        .add(readDynamicSQLExpression(1)),
                );
                break;
            }
            case 'soft-bounce': {
                base.set('softBouncesCount',
                    SQL.calculation(SQL.column('softBouncesCount'))
                        .add(readDynamicSQLExpression(1)),
                );
                break;
            }
            case 'complaint': {
                base.set('spamComplaintsCount',
                    SQL.calculation(SQL.column('spamComplaintsCount'))
                        .add(readDynamicSQLExpression(1)),
                );
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

            console.log('Updating recipient count for email', id);

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
                    console.log('Canceled recipient count update for email', id, 'already created recipients');
                    return;
                }
                upToDate.emailRecipientsCount = count;
                upToDate.recipientsErrors = null;
                await upToDate.save();

                console.log('Updated recipient count for email', id, 'to', count);
            } catch (e) {
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

    getLanguages() {
        return this.language ? [this.language, ...this.translations.keys()] : null;
    }

    getStructure() {
        return EmailStruct.create(this);
    }

    /**
     * The languages an example recipient should be generated for: every language the platform
     * supports (the composer can add translations for those), plus every language the email
     * already has content for.
     *
     * Languages the I18n would correct to a different language (no longer supported for this
     * country) are excluded: their example values would be generated in the corrected language,
     * which is more misleading than falling back to the single example recipient.
     */
    getExampleRecipientLanguages(country: Country): Language[] {
        const languages = new Set<Language>();
        for (const list of Object.values(I18n.validLocales)) {
            for (const language of list) {
                languages.add(language);
            }
        }
        if (this.language) {
            languages.add(this.language);
        }
        for (const language of this.translations.keys()) {
            languages.add(language);
        }
        return [...languages].filter(language => new I18n(language, country).language === language);
    }
}
