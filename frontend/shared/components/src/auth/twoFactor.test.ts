import { User } from '@stamhoofd/structures';
import { describe, expect, test } from 'vitest';
import { hasTwoFactor } from './twoFactor';

function createUser(options: { hasAccount?: boolean; hasTwoFactor?: boolean } = {}) {
    return User.create({
        email: 'admin@example.com',
        hasAccount: options.hasAccount ?? true,
        hasTwoFactor: options.hasTwoFactor ?? false,
    });
}

describe('hasTwoFactor', () => {
    test('an account with a second factor is protected', () => {
        expect(hasTwoFactor([createUser({ hasTwoFactor: true })])).toBe(true);
    });

    test('an account without a second factor is not protected', () => {
        expect(hasTwoFactor([createUser({ hasTwoFactor: false })])).toBe(false);
    });

    test('an invitation that was not accepted yet has no status', () => {
        expect(hasTwoFactor([createUser({ hasAccount: false, hasTwoFactor: false })])).toBeNull();
        expect(hasTwoFactor([])).toBeNull();
    });

    test('every account of an admin needs a second factor', () => {
        const protectedUser = createUser({ hasTwoFactor: true });
        const unprotectedUser = createUser({ hasTwoFactor: false });

        expect(hasTwoFactor([protectedUser, unprotectedUser])).toBe(false);
        expect(hasTwoFactor([protectedUser, createUser({ hasTwoFactor: true })])).toBe(true);
    });

    test('accounts that were only invited are ignored', () => {
        const invited = createUser({ hasAccount: false });
        expect(hasTwoFactor([invited, createUser({ hasTwoFactor: true })])).toBe(true);
    });
});
