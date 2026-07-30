import type { User } from '@stamhoofd/structures';

/**
 * Whether these accounts are protected by two-factor authentication.
 *
 * An admin can have multiple user accounts (a member with multiple email addresses) and
 * every one of them is a way in, so the weakest one decides.
 *
 * Returns null when there is nothing to say yet: the invitation wasn't accepted, so there
 * is no account that could have a second factor.
 */
export function hasTwoFactor(users: User[]): boolean | null {
    const withAccount = users.filter(u => u.hasAccount);
    if (withAccount.length === 0) {
        return null;
    }

    return withAccount.every(u => u.hasTwoFactor);
}
