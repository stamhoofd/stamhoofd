import { Email, EmailAddress } from '@stamhoofd/email';
import { AuditLog, Organization } from '@stamhoofd/models';
import { DateTime } from 'luxon';

import { registerCron } from '@stamhoofd/crons';
import { AuditLogReplacement, AuditLogReplacementType, AuditLogSource, AuditLogType } from '@stamhoofd/structures';

// Importing postmark returns undefined (this is a bug, so we need to use require)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const postmark = require('postmark') as typeof import('postmark');

let lastPostmarkCheck: Date | null = null;
let lastPostmarkIds: Set<number> = new Set();

registerCron('checkPostmarkBounces', checkPostmarkBounces);

async function saveLog({ email, organization, type, subType, id, response, subject, sender }: { id: number; sender: string; email: string; response: string; subject: string;organization: Organization | undefined; type: AuditLogType; subType?: string }) {
    const log = new AuditLog();
    log.organizationId = organization?.id ?? null;
    log.externalId = 'postmark-bounce-' + id.toString();
    log.type = type;
    log.objectId = email;
    log.source = AuditLogSource.System;
    log.replacements = new Map([
        ['e', AuditLogReplacement.create({
            value: email || '',
            type: AuditLogReplacementType.EmailAddress,
        })],
        ['subType', AuditLogReplacement.key(subType || 'unknown')],
        ['response', AuditLogReplacement.longText(response)],
        ['sender', AuditLogReplacement.create({
            value: sender,
            type: AuditLogReplacementType.EmailAddress,
        })],
    ]);

    if (subject) {
        log.replacements.set('subject', AuditLogReplacement.string(subject));
    }

    // Check if we already logged this bounce
    const existing = await AuditLog.select().where('externalId', log.externalId).first(false);
    if (existing) {
        console.log('Already logged this bounce, skipping');
        return;
    }

    await log.save();
}

async function checkPostmarkBounces() {
    if (STAMHOOFD.environment !== 'production') {
        // return;
    }

    const token = STAMHOOFD.POSTMARK_SERVER_TOKEN;
    if (!token) {
        console.log('No postmark token, skipping postmark bounces');
        return;
    }
    const fromDate = (lastPostmarkCheck ?? new Date(new Date().getTime() - 24 * 60 * 60 * 1000 * 2));
    const ET = DateTime.fromJSDate(fromDate).setZone('EST').toISO({ includeOffset: false });

    if (!ET) {
        console.error('Could not convert date to EST:', fromDate);
        return;
    }
    console.log('Checking bounces from Postmark since', fromDate, ET);
    const client = new postmark.ServerClient(token);

    const toDate = DateTime.now().setZone('EST').toISO({ includeOffset: false });

    if (!toDate) {
        console.error('Could not convert date to EST:', new Date());
        return;
    }

    let offset = 0;
    let total = 1;
    const count = 500;

    // Sadly the postmark api returns bounces in the wrong order, to make them easier fetchable so we need to fetch them all in one go every time
    while (offset < total && offset <= 10000 - count) {
        const bounces = await client.getBounces({
            fromDate: ET,
            toDate,
            count,
            offset,
        });

        if (bounces.TotalCount === 0) {
            console.log('No Postmark bounces at this time');
            return;
        }

        total = bounces.TotalCount;

        console.log('Found', bounces.TotalCount, 'bounces from Postmark');

        let lastId: number | null = null;
        const idList = new Set<number>();
        let newEventCount = 0;

        for (const bounce of bounces.Bounces) {
            idList.add(bounce.ID);
            if (lastPostmarkIds.has(bounce.ID)) {
                lastId = bounce.ID;
                continue;
            }
            newEventCount += 1;

            // Try to get the organization, if possible, else default to global blocking: "null", which is not visible for an organization, but it is applied
            const source = bounce.From;
            const organization = source ? await Organization.getByEmail(source) : undefined;
            console.log(bounce);

            if (bounce.Type === 'SpamComplaint' || bounce.Type === 'SpamNotification' || bounce.Type === 'VirusNotification') {
                console.log('Postmark ' + bounce.Type + ' for: ', bounce.Email, 'from', source, 'organization', organization?.name);
                const emailAddress = await EmailAddress.getOrCreate(bounce.Email, organization?.id ?? null);
                emailAddress.markedAsSpam = true;
                await emailAddress.save();

                if (bounce.Type === 'VirusNotification') {
                    await saveLog({
                        email: bounce.Email,
                        organization,
                        type: AuditLogType.EmailAddressFraudComplaint,
                        subType: bounce.Type,
                        response: bounce.Details,
                        id: bounce.ID,
                        subject: bounce.Subject,
                        sender: bounce.From,
                    });
                }
                else {
                    await saveLog({
                        email: bounce.Email,
                        organization,
                        type: AuditLogType.EmailAddressMarkedAsSpam,
                        subType: bounce.Type,
                        response: bounce.Details,
                        id: bounce.ID,
                        subject: bounce.Subject,
                        sender: bounce.From,
                    });
                }
            }
            else if (bounce.Inactive) {
                // Block for everyone, but not visible
                console.log('Postmark ' + bounce.Type + ' for: ', bounce.Email, 'from', source, 'organization', organization?.name);
                const emailAddress = await EmailAddress.getOrCreate(bounce.Email, organization?.id ?? null);
                emailAddress.hardBounce = true;
                await emailAddress.save();
                await saveLog({
                    email: bounce.Email,
                    organization,
                    type: AuditLogType.EmailAddressHardBounced,
                    subType: bounce.Type,
                    response: bounce.Details,
                    id: bounce.ID,
                    subject: bounce.Subject,
                    sender: bounce.From,
                });
            }
            else {
                if (bounce.Type === 'SMTPApiError' && bounce.Details.startsWith("ErrorCode: '406'")) {
                    console.log('Email on Postmark suppression list: ' + bounce.Type + ': ', bounce.Email, 'from', source, 'organization', organization?.name);

                    // We've sent a message to an email that is blocked by Postmark
                    await saveLog({
                        email: bounce.Email,
                        organization,
                        type: AuditLogType.EmailAddressHardBounced,
                        subType: 'ExternalSuppressionList',
                        response: bounce.Details,
                        id: bounce.ID,
                        subject: '', // bounce.Subject is not correct here for some reason
                        sender: bounce.From,
                    });
                }
                else {
                    if (bounce.Type === 'SMTPApiError') {
                        // Log internally
                        Email.sendWebmaster({
                            subject: 'Received an SMTPApiError from Postmark',
                            text: 'We received an SMTPApiError for an e-mail from the organization: ' + organization?.name + '. Please check and adjust if needed.\n' + JSON.stringify(bounce, undefined, 4),
                        });
                    }
                    else {
                        console.log('Unhandled Postmark ' + bounce.Type + ': ', bounce.Email, 'from', source, 'organization', organization?.name);

                        await saveLog({
                            email: bounce.Email,
                            organization,
                            type: AuditLogType.EmailAddressSoftBounced,
                            subType: bounce.Type,
                            response: bounce.Details,
                            id: bounce.ID,
                            subject: bounce.Subject,
                            sender: bounce.From,
                        });
                    }
                }
            }

            const bouncedAt = new Date(bounce.BouncedAt);
            lastPostmarkCheck = lastPostmarkCheck ? new Date(Math.max(bouncedAt.getTime(), lastPostmarkCheck.getTime())) : bouncedAt;

            lastId = bounce.ID;
        }

        if (lastId && newEventCount === 0) {
            console.log('Postmark has no new bounces');
            // Increase timestamp by one second to avoid refetching it every time
            if (lastPostmarkCheck) {
                lastPostmarkCheck = new Date(lastPostmarkCheck.getTime() + 1000);
            }
        }
        lastPostmarkIds = idList;

        offset += bounces.Bounces.length;
    }
}
