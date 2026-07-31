import type { User } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

/**
 * An admin account that is not used anymore is an unnecessary risk, so the admin lists
 * flag every admin who didn't sign in for this long.
 */
export const INACTIVE_ADMIN_MONTHS = 2;

function getInactiveLimit(): Date {
    const limit = new Date();
    limit.setMonth(limit.getMonth() - INACTIVE_ADMIN_MONTHS);
    return limit;
}

/**
 * The most recent moment one of these users signed in. An admin can have multiple user
 * accounts (a member with multiple email addresses), and using any of them counts.
 */
export function getLastActiveAt(users: User[]): Date | null {
    let last: Date | null = null;
    for (const user of users) {
        if (user.lastActiveAt && (last === null || user.lastActiveAt > last)) {
            last = user.lastActiveAt;
        }
    }
    return last;
}

/**
 * Users who never signed in are not counted as inactive: the list already shows that they
 * were invited or never signed in, so a warning on top of that adds nothing.
 */
export function isInactiveAdmin(users: User[]): boolean {
    const signedIn = users.filter(u => u.hasAccount && u.lastActiveAt);
    if (signedIn.length === 0) {
        return false;
    }

    const lastActiveAt = getLastActiveAt(signedIn);
    return lastActiveAt !== null && lastActiveAt < getInactiveLimit();
}

/**
 * Description of the last activity, or null when there is nothing meaningful to show
 * (the invitation wasn't accepted yet).
 */
export function getLastActiveDescription(users: User[]): string | null {
    const withAccount = users.filter(u => u.hasAccount);
    if (withAccount.length === 0) {
        return null;
    }

    const lastActiveAt = getLastActiveAt(withAccount);
    if (!lastActiveAt) {
        return $t('%ZhX');
    }

    return $t('%ZhM', { date: Formatter.date(lastActiveAt, true) });
}
