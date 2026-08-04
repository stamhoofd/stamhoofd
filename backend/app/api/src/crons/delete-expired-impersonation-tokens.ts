import { registerCron } from '@stamhoofd/crons';
import { ImpersonationToken } from '@stamhoofd/models';

let lastRunDate: number | null = null;

registerCron('deleteExpiredImpersonationTokens', deleteExpiredImpersonationTokens);

/**
 * Sweep the one-time tickets of impersonation links. A ticket that is opened is consumed,
 * and one that is superseded is deleted, but a link that is simply never opened has
 * nothing left to trigger that. Runs every night at 5 AM.
 */
export async function deleteExpiredImpersonationTokens() {
    const now = new Date();

    if (now.getDate() === lastRunDate) {
        return;
    }

    const hour = now.getHours();

    // between 5 and 6 AM
    if (hour !== 5 && STAMHOOFD.environment !== 'development') {
        return;
    }

    const tokens = await ImpersonationToken.deleteExpired();
    console.log(`Deleted ${tokens} expired impersonation tokens.`);

    lastRunDate = now.getDate();
}
