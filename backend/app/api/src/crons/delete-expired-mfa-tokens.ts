import { registerCron } from '@stamhoofd/crons';
import { MFAToken, WebauthnChallenge } from '@stamhoofd/models';

let lastRunDate: number | null = null;

registerCron('deleteExpiredMFATokens', deleteExpiredMFATokens);

/**
 * Sweep the short-lived tokens of the two-factor flows.
 *
 * Both are also cleaned up while they are used (a new challenge supersedes the previous
 * one, and an expired token is dropped when it is looked up), but a token of a login that
 * was simply abandoned has nothing left to trigger that. Run every night at 5 AM.
 */
export async function deleteExpiredMFATokens() {
    const now = new Date();

    if (now.getDate() === lastRunDate) {
        return;
    }

    const hour = now.getHours();

    // between 5 and 6 AM
    if (hour !== 5 && STAMHOOFD.environment !== 'development') {
        return;
    }

    const tokens = await MFAToken.deleteExpired();
    const challenges = await WebauthnChallenge.deleteExpired();

    console.log(`Deleted ${tokens} expired MFA tokens and ${challenges} expired WebAuthn challenges.`);

    lastRunDate = now.getDate();
}
