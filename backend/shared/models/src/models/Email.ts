import { column, Model } from '@simonbackx/simple-database';
import { EditorSmartButton, EditorSmartVariable, EmailAttachment, EmailPreview, EmailRecipientFilter, EmailRecipientFilterType, EmailRecipientsStatus, EmailRecipient as EmailRecipientStruct, EmailStatus, Email as EmailStruct, getExampleRecipient, LimitedFilteredRequest, PaginatedResponse, Recipient, SortItemDirection } from '@stamhoofd/structures';
import { v4 as uuidv4 } from "uuid";

import { AnyDecoder, ArrayDecoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { Email as EmailClass } from "@stamhoofd/email";
import { QueueHandler } from '@stamhoofd/queues';
import { SQL, SQLWhereSign } from '@stamhoofd/sql';
import { Formatter } from '@stamhoofd/utility';
import { getEmailBuilder } from '../helpers/EmailBuilder';
import { EmailRecipient } from './EmailRecipient';
import { Organization } from './Organization';

export class Email extends Model {
    static table = "emails";

    @column({
        primary: true, type: "string", beforeSave(value) {
            return value ?? uuidv4();
        }
    })
    id!: string;

    @column({ type: "string", nullable: true })
    organizationId: string|null = null;

    @column({ type: "string", nullable: true})
    userId: string|null = null;

    @column({ type: "json", decoder: EmailRecipientFilter })
    recipientFilter: EmailRecipientFilter = EmailRecipientFilter.create({})

    @column({ type: "string", nullable: true })
    subject: string|null

    /** Raw json structure to edit the template */ 
    @column({ type: "json", decoder: AnyDecoder })
    json: any = {};

    @column({ type: "string", nullable: true })
    html: string|null = null

    @column({ type: "string", nullable: true})
    text: string|null = null

    @column({ type: "string", nullable: true})
    fromAddress: string|null = null

    @column({ type: "string", nullable: true})
    fromName: string|null = null

    @column({ type: "integer", nullable: true})
    recipientCount: number|null = null

    @column({ type: "string" })
    status = EmailStatus.Draft;

    @column({ type: "string" })
    recipientsStatus = EmailRecipientsStatus.NotCreated;

    /**
     * todo: ignore automatically
     */
    @column({ type: "json", decoder: new ArrayDecoder(EmailAttachment) })
    attachments: EmailAttachment[] = []

    
    @column({
        type: "datetime",
        nullable: true
    })
    sentAt: Date|null = null

    @column({
        type: "datetime", beforeSave(old?: any) {
            if (old !== undefined) {
                return old;
            }
            const date = new Date()
            date.setMilliseconds(0)
            return date
        }
    })
    createdAt: Date

    @column({
        type: "datetime", beforeSave() {
            const date = new Date()
            date.setMilliseconds(0)
            return date
        },
        skipUpdate: true
    })
    updatedAt: Date

    static recipientLoaders: Map<EmailRecipientFilterType, {
        fetch(request: LimitedFilteredRequest): Promise<PaginatedResponse<EmailRecipientStruct[], LimitedFilteredRequest>>
        count(request: LimitedFilteredRequest): Promise<number>
    }> = new Map()

    throwIfNotReadyToSend() {
        if (this.subject == null || this.subject.length == 0) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Missing subject',
                human: 'Vul een onderwerp in voor je een e-mail verstuurt'
            })
        }

        if (this.text == null || this.text.length == 0) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Missing text',
                human: 'Vul een tekst in voor je een e-mail verstuurt'
            })
        }

        if (this.html == null || this.html.length == 0) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Missing html',
                human: 'Vul een tekst in voor je een e-mail verstuurt'
            })
        }
    }

    getFromAddress() {
        if (!this.fromName) {
            return this.fromAddress!
        }

        const cleanedName = Formatter.emailSenderName(this.fromName)
        if (cleanedName.length < 2) {
            return this.fromAddress!
        }
        return '"'+cleanedName+'" <'+this.fromAddress+'>'

    }

    getDefaultFromAddress(organization?: Organization|null): string {
        let address = "noreply@stamhoofd.email";

        if (organization) {
            address = organization.uri+"@stamhoofd.email";
        }

        if (!this.fromName) {
            return address
        }

        const cleanedName = Formatter.emailSenderName(this.fromName)
        if (cleanedName.length < 2) {
            return address
        }
        return '"'+cleanedName+'" <'+address+'>'

    }

    async send() {
        this.throwIfNotReadyToSend()
        await this.save();

        const id = this.id;
        return await QueueHandler.schedule('send-email', async function () {
            let upToDate = await Email.getByID(id);
            if (!upToDate) {
                throw new SimpleError({
                    code: 'not_found',
                    message: 'Email not found',
                    human: 'De e-mail die je probeert te versturen bestaat niet meer'
                })
            }
            if (upToDate.status === EmailStatus.Sent) {
                // Already done
                // In other cases -> queue has stopped and we can retry
                return;
            }
            const organization = upToDate.organizationId ? await Organization.getByID(upToDate.organizationId) : null;
            upToDate.throwIfNotReadyToSend()

            let from = upToDate.getDefaultFromAddress(organization)
            let replyTo: string | null = upToDate.getFromAddress();

            if (!from) {
                throw new SimpleError({
                    code: 'invalid_field',
                    message: 'Missing from',
                    human: 'Vul een afzender in voor je een e-mail verstuurt'
                })
            }

            // Can we send from this e-mail or reply-to?
            if (organization) {
                if (organization.privateMeta.mailDomain && organization.privateMeta.mailDomainActive && upToDate.fromAddress!.endsWith("@"+organization.privateMeta.mailDomain)) {
                    from = upToDate.getFromAddress();
                    replyTo = null;
                }
            } else {
                // Platform
                const domains = Object.values(STAMHOOFD.domains.marketing)

                for (const domain of domains) {
                    if (upToDate.fromAddress!.endsWith("@"+domain)) {
                        from = upToDate.getFromAddress();
                        replyTo = null;
                        break;
                    }
                }
            }

            upToDate.status = EmailStatus.Sending
            upToDate.sentAt = upToDate.sentAt ?? new Date()
            await upToDate.save();

            // Create recipients if not yet created
            await upToDate.buildRecipients()

            // Refresh model
            upToDate = await Email.getByID(id);
            if (!upToDate) {
                throw new SimpleError({
                    code: 'not_found',
                    message: 'Email not found',
                    human: 'De e-mail die je probeert te versturen bestaat niet meer'
                })
            }

            if (upToDate.recipientsStatus !== EmailRecipientsStatus.Created) {
                throw new SimpleError({
                    code: 'recipients_not_created',
                    message: 'Failed to create recipients',
                    human: 'Er ging iets mis bij het aanmaken van de afzenders.'
                })
            }

            // Start actually sending in batches of recipients that are not yet sent
            let idPointer = '';
            const batchSize = 100;
            const recipientsSet = new Set<string>();

            // eslint-disable-next-line no-constant-condition
            while (true) {
                const q = SQL.select()
                    .from(SQL.table('email_recipients'))
                    .where(SQL.column('emailId'), upToDate.id)
                    .where(SQL.column('sentAt'), null)
                    .where(SQL.column('id'), SQLWhereSign.Greater, idPointer);

                q.orderBy(SQL.column('id'), 'ASC')
                q.limit(batchSize)
                
                const data = await q.fetch();

                const recipients = EmailRecipient.fromRows(data, 'email_recipients');

                if (recipients.length == 0) {
                    break;
                }

                const sendingPromises: Promise<void>[] = [];

                for (const recipient of recipients) {
                    if (recipientsSet.has(recipient.id)) {
                        console.error('Found duplicate recipient while sending email', recipient.id)
                        continue;
                    }

                    recipientsSet.add(recipient.email);
                    idPointer = recipient.id;

                    let promiseResolve: (value: void | PromiseLike<void>) => void
                    const promise = new Promise<void>((resolve) => {
                        promiseResolve = resolve;
                    });
                    sendingPromises.push(promise)

                    const callback = async (error: Error|null) => {
                        if (error === null) {
                            // Mark saved
                            recipient.sentAt = new Date();
                            await recipient.save()
                        } else {
                            recipient.failCount += 1;
                            recipient.failErrorMessage = error.message;
                            recipient.firstFailedAt = recipient.firstFailedAt ?? new Date();
                            recipient.lastFailedAt = new Date();
                            await recipient.save()
                        }
                        promiseResolve()
                    }

                    // Do send the email
                    // Create e-mail builder
                    const builder = await getEmailBuilder(organization ?? null, {
                        recipients: [
                            Recipient.create({
                                ...recipient
                            })
                        ],
                        from, 
                        replyTo,
                        subject: upToDate.subject!, 
                        html: upToDate.html,
                        type: "broadcast",
                        callback(error: Error|null ) {
                            callback(error).catch(console.error)
                        },
                    })

                    EmailClass.schedule(builder)
                }

                await Promise.all(sendingPromises);
            }

            console.log('Finished sending email', upToDate.id);

            // Mark email as sent
            upToDate.status = EmailStatus.Sent;
            await upToDate.save();
        });
    }

    updateCount() {
        const id = this.id;
        QueueHandler.schedule('email-count-'+this.id, async function () {
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
                        throw new Error('Loader for type ' + subfilter.type+' has not been initialised on the Email model')
                    }

                    const request = new LimitedFilteredRequest({
                        filter: subfilter.filter,
                        sort: [{key: 'id', order: SortItemDirection.ASC}],
                        limit: 1,
                        search: subfilter.search,
                    })

                    const c = await loader.count(request);
                    
                    count += c
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
            } catch (e) {
                console.error("Failed to update count for email", id);
                console.error(e);
            }
        }).catch(console.error);
    }

    async buildRecipients() {
        const id = this.id;
        await QueueHandler.schedule('email-build-recipients-'+this.id, async function () {
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

            // If it is already creating -> something went wrong (e.g. server restart) and we can safely try again

            upToDate.recipientsStatus = EmailRecipientsStatus.Creating;
            await upToDate.save();

            let count = 0;

            try {
                // Delete all recipients
                await SQL
                    .delete()
                    .from(
                        SQL.table('email_recipients')
                    )
                    .where(SQL.column('emailId'), upToDate.id);

                for (const subfilter of upToDate.recipientFilter.filters) {

                    // Create recipients
                    const loader = Email.recipientLoaders.get(subfilter.type);

                    if (!loader) {
                        throw new Error('Loader for type ' + subfilter.type+' has not been initialised on the Email model')
                    }

                    let request: LimitedFilteredRequest|null = new LimitedFilteredRequest({
                        filter: subfilter.filter,
                        sort: [{key: 'id', order: SortItemDirection.ASC}],
                        limit: 1000,
                        search: subfilter.search,
                    })

                    while (request) {
                        console.log('Loading page', subfilter.type, request)
                        const response = await loader.fetch(request);

                        count += response.results.length;

                        for (const item of response.results) {
                            const recipient = new EmailRecipient();
                            recipient.emailId = upToDate.id;
                            recipient.email = item.email
                            recipient.firstName = item.firstName
                            recipient.lastName = item.lastName
                            recipient.replacements = item.replacements

                            await recipient.save();
                        }

                        request = response.next ?? null;
                    }
                }

                // todo: loop all members that match the filter in batches of 1000
                // create a new row for every member + calculate the replacement values
                // todo: do intermediate checks on whether the email was deleted, and stop processing if needed

                upToDate.recipientsStatus = EmailRecipientsStatus.Created;
                upToDate.recipientCount = count;
                await upToDate.save();
            } catch (e) {
                console.error("Failed to build recipients for email", id);
                console.error(e);
                upToDate.recipientsStatus = EmailRecipientsStatus.NotCreated;
                await upToDate.save();
            }
        }).catch(console.error);
    }

    async buildExampleRecipient() {
        const id = this.id;
        await QueueHandler.schedule('email-build-recipients-'+this.id, async function () {
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
                        SQL.table('email_recipients')
                    )
                    .where(SQL.column('emailId'), upToDate.id);

                for (const subfilter of upToDate.recipientFilter.filters) {

                    // Create recipients
                    const loader = Email.recipientLoaders.get(subfilter.type);

                    if (!loader) {
                        throw new Error('Loader for type ' + subfilter.type+' has not been initialised on the Email model')
                    }

                    let request: LimitedFilteredRequest|null = new LimitedFilteredRequest({
                        filter: subfilter.filter,
                        sort: [{key: 'id', order: SortItemDirection.ASC}],
                        limit: 10,
                        search: subfilter.search,
                    })

                    while (request) {
                        console.log('Loading page', subfilter.type, request)
                        const response = await loader.fetch(request);

                        // Note: it is possible that a result in the database doesn't return a recipient (in memory filtering)
                        // so we do need pagination

                        for (const item of response.results) {
                            const recipient = new EmailRecipient();
                            recipient.emailId = upToDate.id;
                            recipient.email = item.email
                            recipient.firstName = item.firstName
                            recipient.lastName = item.lastName
                            recipient.replacements = item.replacements
                            await recipient.save();
                            return;
                        }

                        request = null;
                    }
                }

                console.warn('No example recipient found for email', id)
            } catch (e) {
                console.error("Failed to build example recipient for email", id);
                console.error(e);
            }
        }).catch(console.error);
    }

    getStructure() {
        return EmailStruct.create(this)
    }

    async getPreviewStructure() {
        const recipient = await SQL.select()
            .from(SQL.table(EmailRecipient.table))
            .where(SQL.column('emailId'), this.id)
            .first(false);

            let recipientRow: EmailRecipientStruct | undefined;

            if(recipient) {
                const emailRecipient = EmailRecipient.fromRow(recipient[EmailRecipient.table]);
                if(emailRecipient) {
                    recipientRow = emailRecipient.getStructure();
                }
            }

            if(!recipientRow) {
                recipientRow = getExampleRecipient();
            }

            const smartVariables = recipientRow ? EditorSmartVariable.forRecipient(recipientRow) : []
            const smartButtons = recipientRow ? EditorSmartButton.forRecipient(recipientRow) : []
            
            return EmailPreview.create({
                ...this,
                exampleRecipient: recipientRow,
                smartVariables,
                smartButtons
            })
    }
}
