/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
    DeleteMessageCommand,
    ReceiveMessageCommand,
    SQSClient,
} from '@aws-sdk/client-sqs';
import { registerCron } from '@stamhoofd/crons';
import { Email, EmailAddress } from '@stamhoofd/email';
import { AuditLog, EmailRecipient, Organization } from '@stamhoofd/models';
import { AuditLogReplacement, AuditLogReplacementType, AuditLogSource, AuditLogType } from '@stamhoofd/structures';
import { ForwardHandler } from '../helpers/ForwardHandler.js';
import { Email as EmailModel } from '@stamhoofd/models';

registerCron('checkComplaints', checkComplaints);
registerCron('checkReplies', checkReplies);
registerCron('checkBounces', checkBounces);

async function saveLog({ email, organization, type, subType, subject, response, sender, id }: { id: string; email: string; organization: Organization | undefined; type: AuditLogType; subType?: string; subject: string; response: string; sender: string }) {
    if (!id || typeof id !== 'string') {
        throw new Error('Invalid AWS SES id received');
    }

    const log = new AuditLog();
    log.organizationId = organization?.id ?? null;
    log.externalId = 'aws-ses-message-' + id.toString();
    log.type = type;
    log.source = AuditLogSource.System;
    log.objectId = email;
    log.replacements = new Map([
        ['e', AuditLogReplacement.create({
            value: email || '',
            type: AuditLogReplacementType.EmailAddress,
        })],
        ['subType', AuditLogReplacement.key(subType || 'unknown')],
        ['subject', AuditLogReplacement.string(subject)],
        ['sender', AuditLogReplacement.create({
            value: sender,
            type: AuditLogReplacementType.EmailAddress,
        })],
    ]);

    if (response) {
        log.replacements.set('response', AuditLogReplacement.longText(response));
    }

    // Check if we already logged this bounce
    const existing = await AuditLog.select().where('externalId', log.externalId).first(false);
    if (existing) {
        console.log('Already logged this bounce, skipping');
        return;
    }

    await log.save();
}

async function storeEmailStatus({ headers, type, message }: { headers: Record<string, string>; type: 'hard-bounce' | 'soft-bounce' | 'complaint'; message: string }) {
    const emailId = headers['x-email-id'];
    const recipientId = headers['x-email-recipient-id'];

    if (emailId && recipientId) {
        // check
        const emailRecipient = await EmailRecipient.select()
            .where('id', recipientId)
            .where('emailId', emailId)
            .first(false);

        if (!emailRecipient) {
            console.log('[AWS FORWARDING] Invalid email or recipient id in headers', headers);
            return;
        }

        let isNew = true;

        switch (type) {
            case 'hard-bounce': {
                if (emailRecipient.hardBounceError) {
                    isNew = false;
                }
                emailRecipient.hardBounceError = message;
                break;
            }
            case 'soft-bounce': {
                if (emailRecipient.softBounceError) {
                    isNew = false;
                }
                emailRecipient.softBounceError = message;
                break;
            }
            case 'complaint': {
                if (emailRecipient.spamComplaintError) {
                    isNew = false;
                }
                emailRecipient.spamComplaintError = message;
                break;
            }
        }

        console.log('[AWS FORWARDING] Marking email recipient ' + recipientId + ' for email ' + emailId + ' as ' + type);
        if (await emailRecipient.save()) {
            if (isNew) {
                await EmailModel.bumpNotificationCount(emailId, type);
            }
        }
    }
}

function readHeaders(message: any) {
    try {
        const mail = message.mail;
        const headers: Record<string, string> = {};
        if (mail && typeof mail === 'object' && mail !== null && Array.isArray(mail.headers)) {
            for (const header of mail.headers) {
                if (header.name && header.value) {
                    headers[(header.name as string).toLowerCase()] = header.value;
                }
            }
        }
        else {
            console.log('[AWS] Missing mail headers', message);
        }
        return headers;
    }
    catch (e) {
        console.log('[AWS] Failed to read headers', e, message);
        return {};
    }
}

async function handleBounce(message: any) {
    if (message.bounce) {
        console.log('[AWS BOUNCES] Handling bounce message', message);
        const headers = readHeaders(message);

        const b = message.bounce;
        // Block all receivers that generate a permanent bounce
        const type = b.bounceType;
        const subtype = b.bounceSubType;
        const source = message.mail.source;

        // try to find organization that is responsible for this e-mail address

        for (const recipient of b.bouncedRecipients) {
            const email = recipient.emailAddress;

            if (
                type === 'Permanent'
                || (
                    recipient.diagnosticCode && (
                        (recipient.diagnosticCode as string).toLowerCase().includes('invalid domain')
                        || (recipient.diagnosticCode as string).toLowerCase().includes('unable to lookup dns')
                    )
                )
            ) {
                const organization: Organization | undefined = source ? await Organization.getByEmail(source) : undefined;
                const emailAddress = await EmailAddress.getOrCreate(email, organization?.id ?? null);
                emailAddress.hardBounce = true;
                await emailAddress.save();

                await storeEmailStatus({
                    headers,
                    type: 'hard-bounce',
                    message: recipient.diagnosticCode || 'Permanent bounce',
                });

                await saveLog({
                    id: b.feedbackId,
                    email,
                    organization,
                    type: AuditLogType.EmailAddressHardBounced,
                    subType: subtype || 'unknown',
                    sender: source,
                    response: recipient.diagnosticCode || '',
                    subject: message.mail.commonHeaders?.subject || '',
                });
            }
            else if (
                type === 'Transient'
            ) {
                const organization: Organization | undefined = source ? await Organization.getByEmail(source) : undefined;

                await storeEmailStatus({
                    headers,
                    type: 'soft-bounce',
                    message: recipient.diagnosticCode || 'Soft bounce',
                });

                await saveLog({
                    id: b.feedbackId,
                    email,
                    organization,
                    type: AuditLogType.EmailAddressSoftBounced,
                    subType: subtype || 'unknown',
                    sender: source,
                    response: recipient.diagnosticCode || '',
                    subject: message.mail.commonHeaders?.subject || '',
                });
            }
        }
        console.log('[AWS BOUNCES] For domain ' + source);
    }
    else {
        console.log("[AWS BOUNCES] 'bounce' field missing in bounce message");
    }
}

async function handleComplaint(message: any) {
    if (message.complaint) {
        const headers = readHeaders(message);
        const b = message.complaint;
        const source = message.mail.source;
        const organization: Organization | undefined = source ? await Organization.getByEmail(source) : undefined;

        const type: 'abuse' | 'auth-failure' | 'fraud' | 'not-spam' | 'other' | 'virus' = b.complaintFeedbackType;

        for (const recipient of b.complainedRecipients) {
            const email = recipient.emailAddress;
            const emailAddress = await EmailAddress.getOrCreate(email, organization?.id ?? null);
            emailAddress.markedAsSpam = type !== 'not-spam';
            await emailAddress.save();

            if (type !== 'not-spam') {
                await storeEmailStatus({
                    headers,
                    type: 'complaint',
                    message: recipient.diagnosticCode || type || 'Complaint',
                });

                if (type === 'virus' || type === 'fraud') {
                    await saveLog({
                        id: b.feedbackId,
                        email,
                        organization,
                        type: AuditLogType.EmailAddressFraudComplaint,
                        subType: type || 'unknown',
                        sender: source,
                        response: recipient.diagnosticCode || '',
                        subject: message.mail.commonHeaders?.subject || '',
                    });
                }
                else {
                    await saveLog({
                        id: b.feedbackId,
                        email,
                        organization,
                        type: AuditLogType.EmailAddressMarkedAsSpam,
                        subType: type || 'unknown',
                        sender: source,
                        response: recipient.diagnosticCode || '',
                        subject: message.mail.commonHeaders?.subject || '',
                    });
                }
            }
        }

        if (type === 'virus' || type === 'fraud') {
            console.error('[AWS COMPLAINTS] Received virus / fraud complaint!');
            console.error('[AWS COMPLAINTS]', message.complaint);
            if (STAMHOOFD.environment !== 'development') {
                Email.sendWebmaster({
                    subject: 'Received a ' + type + ' email notification',
                    text: 'We received a ' + type + ' notification for an e-mail from the organization: ' + organization?.name + '. Please check and adjust if needed.\n',
                });
            }
        }
    }
    else {
        console.log('[AWS COMPLAINTS] Missing complaint field');
    }
}

async function handleForward(message: any) {
    if (message.mail && message.content && message.receipt) {
        const content = message.content;
        const receipt = message.receipt as {
            recipients: string[];
            spamVerdict: { status: 'PASS' | string };
            virusVerdict: { status: 'PASS' | string };
            spfVerdict: { status: 'PASS' | string };
            dkimVerdict: { status: 'PASS' | string };
            dmarcVerdict: { status: 'PASS' | string };
        };

        const options = await ForwardHandler.handle(content, receipt);
        if (options) {
            if (STAMHOOFD.environment !== 'development') {
                Email.send(options);
            }
        }
    }
    else {
        console.log('[AWS FORWARDING] Missing mail, content or receipt field');
    }
}

let sharedClient: SQSClient | null = null;
function getClient() {
    if (!sharedClient) {
        sharedClient = new SQSClient({});
    }
    return sharedClient;
}

async function readFromQueue(queueUrl: string) {
    console.log('[AWS Queue] Checking ' + queueUrl);

    const client = getClient();

    const cmd = new ReceiveMessageCommand({
        MaxNumberOfMessages: 10,
        QueueUrl: queueUrl,
    });

    const messages = await client.send(cmd);
    let didProcess = 0;
    if (messages.Messages) {
        for (const message of messages.Messages) {
            console.log('[AWS Queue] Received message');
            console.log('[AWS Queue]', message);

            if (message.ReceiptHandle) {
                if (STAMHOOFD.environment !== 'development') {
                    const deleteCmd = new DeleteMessageCommand({
                        QueueUrl: queueUrl,
                        ReceiptHandle: message.ReceiptHandle,
                    });

                    await client.send(deleteCmd);
                    console.log('[AWS Queue] Deleted from queue');
                }
            }
            didProcess += 1;

            try {
                if (message.Body) {
                    // decode the JSON value
                    const bounce = JSON.parse(message.Body);

                    if (bounce.Message) {
                        const message = JSON.parse(bounce.Message);

                        // Docs: https://docs.aws.amazon.com/ses/latest/dg/event-publishing-retrieving-sns-contents.html
                        if (message.bounce) {
                            await handleBounce(message);
                        }
                        else if (message.complaint) {
                            await handleComplaint(message);
                        }
                        // Read message content
                        // https://docs.aws.amazon.com/ses/latest/dg/receiving-email-notifications-contents.html
                        else if (message.mail && message.content && message.receipt) {
                            await handleForward(message);
                        }
                        else {
                            console.log('[AWS Queue] Unsupported message');
                        }
                    }
                    else {
                        console.log("[AWS Queue] 'Message' field missing");
                    }
                }
                else {
                    console.log('[AWS Queue] Message Body missing in bounce');
                }
            }
            catch (e) {
                console.log('[AWS Queue] Message processing failed:');
                console.log('[AWS Queue]', e);

                console.error('[AWS Queue] Message processing failed:');
                console.error('[AWS Queue]', e);
            }
        }
    }

    if (didProcess) {
        console.log(`[AWS Queue] Processed ${didProcess} message(s) from queue`);
    }
    else {
        console.log(`[AWS Queue] No message to process from queue`);
    }
    return didProcess;
}

async function readAllFromQueue(queueUrl: string) {
    let readCount = 0;
    while (readCount < 20) {
        const didProcess = await readFromQueue(queueUrl);
        if (!didProcess) {
            break;
        }
        readCount += didProcess;
    }
    console.log(`[AWS Queue] Finished processing all messages from queue (${readCount} messages processed)`);
    return true;
}

async function checkBounces() {
    if (!STAMHOOFD.AWS_ACCESS_KEY_ID || !STAMHOOFD.AWS_BOUNCE_QUEUE_URL) {
        return;
    }

    await readAllFromQueue(STAMHOOFD.AWS_BOUNCE_QUEUE_URL);
}

async function checkReplies() {
    if (!STAMHOOFD.AWS_ACCESS_KEY_ID || !STAMHOOFD.AWS_FORWARDING_QUEUE_URL) {
        return;
    }

    await readAllFromQueue(STAMHOOFD.AWS_FORWARDING_QUEUE_URL);
}

async function checkComplaints() {
    if (!STAMHOOFD.AWS_ACCESS_KEY_ID || !STAMHOOFD.AWS_COMPLAINTS_QUEUE_URL) {
        return;
    }

    await readAllFromQueue(STAMHOOFD.AWS_COMPLAINTS_QUEUE_URL);
}
