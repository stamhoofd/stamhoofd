import { RateLimiter } from '@stamhoofd/models';

export const MAX_AUTH_EMAILS_PER_HOUR = 5;

/**
 * The emails of the authentication flows (a verification code, a password recovery link, the
 * notice that an address already has an account) are all triggered by whoever knows an address,
 * not by its owner, so cap how many of them one address can receive. Like every rate limiter here
 * it counts per process and in a window shared by all addresses, so it thins out a flood rather
 * than enforcing an exact number of emails.
 */
const authEmailRateLimiter = new RateLimiter({
    limits: [
        {
            limit: MAX_AUTH_EMAILS_PER_HOUR,
            duration: 60 * 60 * 1000,
        },
        {
            limit: 15,
            duration: 24 * 60 * 60 * 1000,
        },
    ],
});

/**
 * Returns false when this address already received too many authentication emails. The caller
 * skips the email and keeps its response unchanged: the requester may not own the address, so
 * reporting the limit would expose whether it is in use.
 */
export function canSendAuthEmail(email: string): boolean {
    try {
        authEmailRateLimiter.track(email.toLowerCase(), 1);
        return true;
    } catch {
        return false;
    }
}
