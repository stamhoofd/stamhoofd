import { isSimpleError, isSimpleErrors, SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import type { EmailInterfaceRecipient } from '@stamhoofd/email';
import { Email as EmailClass } from '@stamhoofd/email';
import { Email, EmailRecipient, Organization, Platform } from '@stamhoofd/models';
import { canSendFromEmail, fillRecipientReplacements, getEmailBuilder, mergeReplacementsIfEqual, removeUnusedReplacements } from '../helpers/EmailBuilder.js';
import { errorToSimpleErrors } from '@stamhoofd/models/helpers/errorToSimpleErrors.js';
import { isAbortedError, QueueHandler } from '@stamhoofd/queues';
import { SQL, SQLWhereSign } from '@stamhoofd/sql';
import { EmailRecipientsStatus, EmailStatus, isSoftEmailRecipientError, LimitedFilteredRequest, SortItemDirection } from '@stamhoofd/structures';

type Attachment = { filename: string; path?: string; href?: string; content?: string | Buffer; contentType?: string; encoding?: string };

/**
 * Sends an email to its recipients: queueing, the per-recipient send and resuming an interrupted send.
 */
export class EmailSendService {
    static async queueForSending(email: Email, waitForSending = false) {
        console.log('Queueing email for sending', email.id);
        email.throwIfNotReadyToSend();
        email.throwIfNoUnsubscribeButton();
        await email.lock(async (upToDate) => {
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
            return await this.resumeSending(email);
        } else {
            this.resumeSending(email).catch(console.error);
        }
        return email;
    }

    private static async loadAttachments(email: Email): Promise<Attachment[]> {
        const attachments: Attachment[] = [];
        for (const attachment of email.attachments) {
            if (!attachment.content && !attachment.file) {
                console.warn('Attachment without content found, skipping', attachment);
                continue;
            }

            let filename = $t('%180');

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
            } else {
                // Note: because we send lots of emails, we better download the file here so we can reuse it in every email instead of downloading it every time
                const withSigned = await attachment.file!.withSignedUrl();
                if (!withSigned || !withSigned.signedUrl) {
                    throw new SimpleError({
                        code: 'attachment_not_found',
                        message: 'Attachment not found',
                        human: $t(`%181`),
                    });
                }

                const filePath = withSigned.signedUrl;
                let fileBuffer: Buffer | null;
                try {
                    const response = await fetch(filePath);
                    fileBuffer = Buffer.from(await response.arrayBuffer());
                } catch (e) {
                    throw new SimpleError({
                        code: 'attachment_not_found',
                        message: 'Attachment not found',
                        human: $t(`%181`),
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

    private static async sendSingleRecipient(email: Email, recipient: EmailRecipient, organization: Organization | null, data: { from: EmailInterfaceRecipient; replyTo: EmailInterfaceRecipient | null; attachments: Attachment[] }) {
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
                } else {
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
            } catch (e) {
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
            subject: email.subject!,
            html: email.html!,
            translations: email.translations,
            type: email.emailType ? 'transactional' : 'broadcast',
            attachments: data.attachments,
            callback(error: Error | null) {
                callback(error).catch(console.error);
            },
            headers: {
                'X-Email-Id': email.id,
                'X-Email-Recipient-Id': recipient.id,
            },
        });
        EmailClass.schedule(builder);
        return await promise;
    }

    static async resumeSending(email: Email, singleRecipientId: string | null = null): Promise<Email | null> {
        const id = email.id;
        return await QueueHandler.schedule('send-email', async ({ abort }) => {
            return await email.lock(async function (upToDate: Email) {
                if (upToDate.status === EmailStatus.Sent) {
                    // Already done
                    // In other cases -> queue has stopped and we can retry
                    if (!singleRecipientId) {
                        console.log('Email already sent, skipping...', upToDate.id);
                        return upToDate;
                    }
                } else {
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
                    } else if (upToDate.status !== EmailStatus.Queued) {
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
                            human: $t(`%ww`),
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
                    await EmailSendService.buildRecipients(upToDate);
                    abort.throwIfAborted();

                    // Refresh model
                    const c = (await Email.getByID(id))!;
                    if (!c) {
                        throw new SimpleError({
                            code: 'not_found',
                            message: 'Email not found',
                            human: $t(`%wz`),
                        });
                    }
                    upToDate.copyFrom(c);

                    if (upToDate.recipientsStatus !== EmailRecipientsStatus.Created) {
                        throw new SimpleError({
                            code: 'recipients_not_created',
                            message: 'Failed to create recipients',
                            human: $t(`%x0`),
                        });
                    }

                    // Create a buffer of all attachments
                    if (upToDate.sendAsEmail === true) {
                        const attachments = await EmailSendService.loadAttachments(upToDate);

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
                            } finally {
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
                                        } else {
                                            failedCount += 1;
                                        }
                                        skipped++;
                                        await saveStatus();
                                        continue;
                                    }
                                }

                                const promise = EmailSendService.sendSingleRecipient(upToDate, recipient, organization ?? null, {
                                    from,
                                    replyTo,
                                    attachments,
                                });
                                sendingPromises.push(promise.then(async () => {
                                    if (recipient.sentAt) {
                                        succeededCount += 1;
                                        await saveStatus();
                                    } else {
                                        // Failed or soft-failed
                                        if (recipient.failError && isSoftEmailRecipientError(recipient.failError)) {
                                            softFailedCount += 1;
                                        } else {
                                            failedCount += 1;
                                        }
                                        await saveStatus();
                                    }
                                }));
                            }

                            if (sendingPromises.length > 0 || skipped > 0) {
                                await Promise.all(sendingPromises);
                            } else {
                                break;
                            }
                        }
                    }
                } catch (e) {
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
                                human: $t(`%1EG`),
                            }),
                        );
                    } else {
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

    static async buildRecipients(email: Email) {
        const id = email.id;
        await QueueHandler.schedule('email-build-recipients-' + email.id, async function ({ abort }) {
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
                    human: $t(`%1NV`),
                });
            }
            const platform = await Platform.getSharedPrivateStruct();

            console.log('Building recipients for email', id);

            // If it is already creating -> something went wrong (e.g. server restart) and we can safely try again

            upToDate.recipientsStatus = EmailRecipientsStatus.Creating;
            await upToDate.save();

            const membersSet = new Set<string>();
            const emailsSet = new Set<string>();
            const combinedHtml = upToDate.getCombinedHtml();

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
                        const response = await loader.fetch(request, subfilter.subfilter, beforeFetchAllResult, { allowedLanguages: upToDate.getLanguages() });

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
                            recipient.language = item.language ?? null;
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
                                allowedLanguages: upToDate.getLanguages(),
                            });
                            recipient.replacements = removeUnusedReplacements(combinedHtml, recipient.replacements);

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
                                    } else {
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
                            } else {
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
            } catch (e: unknown) {
                console.error('Failed to build recipients for email', id);
                console.error(e);
                upToDate.recipientsStatus = EmailRecipientsStatus.NotCreated;
                upToDate.recipientsErrors = errorToSimpleErrors(e);
                await upToDate.save();
            }
        });
    }

    static async buildExampleRecipient(email: Email, isNewlyCreated = false) {
        const id = email.id;
        await QueueHandler.schedule('email-build-recipients-' + email.id, async function () {
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
                        const response = await loader.fetch(request, subfilter.subfilter, beforeFetchAllResult, { allowedLanguages: upToDate.getLanguages() });

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
                            recipient.language = item.language ?? null;
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
            } catch (e) {
                console.error('Failed to build example recipient for email', id);
                console.error(e);
            }
        });
    }
}
