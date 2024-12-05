/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { registerCron } from '@stamhoofd/crons';
import { Email, EmailAddress } from '@stamhoofd/email';
import { AuditLog, Organization } from '@stamhoofd/models';
import { AuditLogReplacement, AuditLogReplacementType, AuditLogSource, AuditLogType } from '@stamhoofd/structures';
import AWS from 'aws-sdk';
import { ForwardHandler } from '../helpers/ForwardHandler';

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
        ['response', AuditLogReplacement.longText(response)],
        ['subject', AuditLogReplacement.string(subject)],
        ['sender', AuditLogReplacement.create({
            value: sender,
            type: AuditLogReplacementType.EmailAddress,
        })],
    ]);
    // Check if we already logged this bounce
    const existing = await AuditLog.select().where('externalId', log.externalId).first(false);
    if (existing) {
        console.log('Already logged this bounce, skipping');
        return;
    }

    await log.save();
}

async function checkBounces() {
    if (STAMHOOFD.environment !== 'production' || !STAMHOOFD.AWS_ACCESS_KEY_ID) {
        return;
    }

    console.log('[AWS BOUNCES] Checking bounces from AWS SQS');
    const sqs = new AWS.SQS();
    const messages = await sqs.receiveMessage({ QueueUrl: 'https://sqs.eu-west-1.amazonaws.com/118244293157/stamhoofd-bounces-queue', MaxNumberOfMessages: 10 }).promise();
    if (messages.Messages) {
        for (const message of messages.Messages) {
            console.log('[AWS BOUNCES] Received bounce message');
            console.log('[AWS BOUNCES]', message);

            if (message.ReceiptHandle) {
                if (STAMHOOFD.environment === 'production') {
                    await sqs.deleteMessage({
                        QueueUrl: 'https://sqs.eu-west-1.amazonaws.com/118244293157/stamhoofd-bounces-queue',
                        ReceiptHandle: message.ReceiptHandle,
                    }).promise();
                    console.log('[AWS BOUNCES] Deleted from queue');
                }
            }

            try {
                if (message.Body) {
                    // decode the JSON value
                    const bounce = JSON.parse(message.Body);

                    if (bounce.Message) {
                        const message = JSON.parse(bounce.Message);

                        if (message.bounce) {
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
                                    if (organization) {
                                        const emailAddress = await EmailAddress.getOrCreate(email, organization.id);
                                        emailAddress.hardBounce = true;
                                        await emailAddress.save();
                                    }
                                    else {
                                        console.error('[AWS BOUNCES] Unknown organization for email address ' + source);
                                    }

                                    await saveLog({
                                        id: b.feedbackId,
                                        email,
                                        organization,
                                        type: AuditLogType.EmailAddressHardBounced,
                                        subType: subtype || 'unknown',
                                        sender: source,
                                        response: b.diagnosticCode || '',
                                        subject: message.mail.commonHeaders?.subject || '',
                                    });
                                }
                                else if (
                                    type === 'Transient'
                                ) {
                                    const organization: Organization | undefined = source ? await Organization.getByEmail(source) : undefined;
                                    await saveLog({
                                        id: b.feedbackId,
                                        email,
                                        organization,
                                        type: AuditLogType.EmailAddressSoftBounced,
                                        subType: subtype || 'unknown',
                                        sender: source,
                                        response: b.diagnosticCode || '',
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
                    else {
                        console.log("[AWS BOUNCES] 'Message' field missing in bounce message");
                    }
                }
                else {
                    console.log('[AWS BOUNCES] Message Body missing in bounce');
                }
            }
            catch (e) {
                console.log('[AWS BOUNCES] Bounce message processing failed:');
                console.error('[AWS BOUNCES] Bounce message processing failed:');
                console.error('[AWS BOUNCES]', e);
            }
        }
    }
}

async function checkReplies() {
    if (STAMHOOFD.environment !== 'production' || !STAMHOOFD.AWS_ACCESS_KEY_ID) {
        return;
    }

    console.log('Checking replies from AWS SQS');
    const sqs = new AWS.SQS();
    const messages = await sqs.receiveMessage({ QueueUrl: 'https://sqs.eu-west-1.amazonaws.com/118244293157/stamhoofd-email-forwarding', MaxNumberOfMessages: 10 }).promise();
    if (messages.Messages) {
        for (const message of messages.Messages) {
            console.log('Received message from forwarding queue');

            if (message.ReceiptHandle) {
                if (STAMHOOFD.environment === 'production') {
                    await sqs.deleteMessage({
                        QueueUrl: 'https://sqs.eu-west-1.amazonaws.com/118244293157/stamhoofd-email-forwarding',
                        ReceiptHandle: message.ReceiptHandle,
                    }).promise();
                    console.log('Deleted from queue');
                }
            }

            try {
                if (message.Body) {
                    // decode the JSON value
                    const bounce = JSON.parse(message.Body);

                    if (bounce.Message) {
                        const message = JSON.parse(bounce.Message);

                        // Read message content
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
                                if (STAMHOOFD.environment === 'production') {
                                    Email.send(options);
                                }
                            }
                        }
                    }
                }
            }
            catch (e) {
                console.error(e);
            }
        }
    }
}

async function checkComplaints() {
    if (STAMHOOFD.environment !== 'production' || !STAMHOOFD.AWS_ACCESS_KEY_ID) {
        return;
    }

    console.log('[AWS COMPLAINTS] Checking complaints from AWS SQS');
    const sqs = new AWS.SQS();
    const messages = await sqs.receiveMessage({ QueueUrl: 'https://sqs.eu-west-1.amazonaws.com/118244293157/stamhoofd-complaints-queue', MaxNumberOfMessages: 10 }).promise();
    if (messages.Messages) {
        for (const message of messages.Messages) {
            console.log('[AWS COMPLAINTS] Received complaint message');
            console.log('[AWS COMPLAINTS]', message);

            if (message.ReceiptHandle) {
                if (STAMHOOFD.environment === 'production') {
                    await sqs.deleteMessage({
                        QueueUrl: 'https://sqs.eu-west-1.amazonaws.com/118244293157/stamhoofd-complaints-queue',
                        ReceiptHandle: message.ReceiptHandle,
                    }).promise();
                    console.log('[AWS COMPLAINTS] Deleted from queue');
                }
            }

            try {
                if (message.Body) {
                    // decode the JSON value
                    const complaint = JSON.parse(message.Body);
                    console.log('[AWS COMPLAINTS]', complaint);

                    if (complaint.Message) {
                        const message = JSON.parse(complaint.Message);

                        if (message.complaint) {
                            const b = message.complaint;
                            const source = message.mail.source;
                            const organization: Organization | undefined = source ? await Organization.getByEmail(source) : undefined;

                            const type: 'abuse' | 'auth-failure' | 'fraud' | 'not-spam' | 'other' | 'virus' = b.complaintFeedbackType;

                            if (organization) {
                                for (const recipient of b.complainedRecipients) {
                                    const email = recipient.emailAddress;
                                    const emailAddress = await EmailAddress.getOrCreate(email, organization.id);
                                    emailAddress.markedAsSpam = type !== 'not-spam';
                                    await emailAddress.save();

                                    if (type !== 'not-spam') {
                                        if (type === 'virus' || type === 'fraud') {
                                            await saveLog({
                                                id: b.feedbackId,
                                                email: source,
                                                organization,
                                                type: AuditLogType.EmailAddressFraudComplaint,
                                                subType: type || 'unknown',
                                                sender: source,
                                                response: b.diagnosticCode || '',
                                                subject: message.mail.commonHeaders?.subject || '',
                                            });
                                        }
                                        else {
                                            await saveLog({
                                                id: b.feedbackId,
                                                email: source,
                                                organization,
                                                type: AuditLogType.EmailAddressMarkedAsSpam,
                                                subType: type || 'unknown',
                                                sender: source,
                                                response: b.diagnosticCode || '',
                                                subject: message.mail.commonHeaders?.subject || '',
                                            });
                                        }
                                    }
                                }
                            }
                            else {
                                console.error('[AWS COMPLAINTS] Unknown organization for email address ' + source);
                            }

                            if (type === 'virus' || type === 'fraud') {
                                console.error('[AWS COMPLAINTS] Received virus / fraud complaint!');
                                console.error('[AWS COMPLAINTS]', complaint);
                                if (STAMHOOFD.environment === 'production') {
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
                    else {
                        console.log('[AWS COMPLAINTS] Missing message field in complaint');
                    }
                }
            }
            catch (e) {
                console.log('[AWS COMPLAINTS] Complain message processing failed:');
                console.error('[AWS COMPLAINTS] Complain message processing failed:');
                console.error('[AWS COMPLAINTS]', e);
            }
        }
    }
}
