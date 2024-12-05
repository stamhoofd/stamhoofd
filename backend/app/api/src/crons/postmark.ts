import { EmailAddress } from '@stamhoofd/email';
import { Organization } from '@stamhoofd/models';
import { DateTime } from 'luxon';

import { registerCron } from '@stamhoofd/crons';

// Importing postmark returns undefined (this is a bug, so we need to use require)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const postmark = require('postmark');

let lastPostmarkCheck: Date | null = null;
let lastPostmarkId: string | null = null;

registerCron('checkPostmarkBounces', checkPostmarkBounces);

async function checkPostmarkBounces() {
    if (STAMHOOFD.environment !== 'production') {
        return;
    }

    const token = STAMHOOFD.POSTMARK_SERVER_TOKEN;
    if (!token) {
        console.log('[POSTMARK BOUNCES] No postmark token, skipping postmark bounces');
        return;
    }
    const fromDate = (lastPostmarkCheck ?? new Date(new Date().getTime() - 24 * 60 * 60 * 1000 * 2));
    const ET = DateTime.fromJSDate(fromDate).setZone('EST').toISO({ includeOffset: false });
    console.log('[POSTMARK BOUNCES] Checking bounces from Postmark since', fromDate, ET);
    const client = new postmark.ServerClient(token);

    const bounces = await client.getBounces({
        fromdate: ET,
        todate: DateTime.now().setZone('EST').toISO({ includeOffset: false }),
        count: 500,
        offset: 0,
    });

    if (bounces.TotalCount == 0) {
        console.log('[POSTMARK BOUNCES] No Postmark bounces at this time');
        return;
    }

    let lastId: string | null = null;

    for (const bounce of bounces.Bounces) {
        // Try to get the organization, if possible, else default to global blocking: "null", which is not visible for an organization, but it is applied
        const source = bounce.From;
        const organization = source ? await Organization.getByEmail(source) : undefined;

        if (bounce.Type === 'HardBounce' || bounce.Type === 'BadEmailAddress' || bounce.Type === 'Blocked') {
            // Block for everyone, but not visible
            console.log('[POSTMARK BOUNCES] Postmark ' + bounce.Type + ' for: ', bounce.Email, 'from', source, 'organization', organization?.name);
            const emailAddress = await EmailAddress.getOrCreate(bounce.Email, organization?.id ?? null);
            emailAddress.hardBounce = true;
            await emailAddress.save();
        }
        else if (bounce.Type === 'SpamComplaint' || bounce.Type === 'SpamNotification' || bounce.Type === 'VirusNotification') {
            console.log('[POSTMARK BOUNCES] Postmark ' + bounce.Type + ' for: ', bounce.Email, 'from', source, 'organization', organization?.name);
            const emailAddress = await EmailAddress.getOrCreate(bounce.Email, organization?.id ?? null);
            emailAddress.markedAsSpam = true;
            await emailAddress.save();
        }
        else {
            console.log('[POSTMARK BOUNCES] Unhandled Postmark ' + bounce.Type + ': ', bounce.Email, 'from', source, 'organization', organization?.name);
            console.error('[POSTMARK BOUNCES] Unhandled Postmark ' + bounce.Type + ': ', bounce.Email, 'from', source, 'organization', organization?.name);
        }

        const bouncedAt = new Date(bounce.BouncedAt);
        lastPostmarkCheck = lastPostmarkCheck ? new Date(Math.max(bouncedAt.getTime(), lastPostmarkCheck.getTime())) : bouncedAt;

        lastId = bounce.ID;
    }

    if (lastId && lastPostmarkId) {
        if (lastId === lastPostmarkId) {
            console.log('[POSTMARK BOUNCES] Postmark has no new bounces');
            // Increase timestamp by one second to avoid refetching it every time
            if (lastPostmarkCheck) {
                lastPostmarkCheck = new Date(lastPostmarkCheck.getTime() + 1000);
            }
        }
    }
    lastPostmarkId = lastId;
}
