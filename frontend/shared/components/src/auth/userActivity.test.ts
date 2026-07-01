import { User } from '@stamhoofd/structures';
import { describe, expect, test } from 'vitest';
import { getLastActiveAt, getLastActiveDescription, isInactiveAdmin } from './userActivity';

function daysAgo(days: number): Date {
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function createUser(options: { hasAccount?: boolean; lastActiveAt?: Date | null } = {}) {
    return User.create({
        email: 'admin@example.com',
        hasAccount: options.hasAccount ?? true,
        lastActiveAt: options.lastActiveAt ?? null,
    });
}

describe('userActivity', () => {
    test('an admin who signed in recently is active', () => {
        const user = createUser({ lastActiveAt: daysAgo(7) });
        expect(isInactiveAdmin([user])).toBe(false);
        expect(getLastActiveDescription([user])).toContain('Laatst actief op');
    });

    test('an admin who signed in less than two months ago is still active', () => {
        expect(isInactiveAdmin([createUser({ lastActiveAt: daysAgo(50) })])).toBe(false);
    });

    test('an admin who did not sign in for more than two months is inactive', () => {
        expect(isInactiveAdmin([createUser({ lastActiveAt: daysAgo(90) })])).toBe(true);
    });

    test('an admin who never signed in is not flagged as inactive', () => {
        const user = createUser({ lastActiveAt: null });
        expect(isInactiveAdmin([user])).toBe(false);
        expect(getLastActiveDescription([user])).toBe('Nog nooit aangemeld');
    });

    test('an invitation that was not accepted yet is not flagged', () => {
        const user = createUser({ hasAccount: false, lastActiveAt: null });
        expect(isInactiveAdmin([user])).toBe(false);
        expect(getLastActiveDescription([user])).toBeNull();
    });

    test('using any of the accounts of an admin counts as activity', () => {
        const old = createUser({ lastActiveAt: daysAgo(90) });
        const recent = createUser({ lastActiveAt: daysAgo(3) });

        expect(getLastActiveAt([old, recent])?.getTime()).toBe(recent.lastActiveAt!.getTime());
        expect(isInactiveAdmin([old, recent])).toBe(false);
        expect(isInactiveAdmin([old, createUser({ lastActiveAt: daysAgo(70) })])).toBe(true);
    });

    test('accounts without an account are ignored when looking at the last activity', () => {
        const invited = createUser({ hasAccount: false, lastActiveAt: null });
        const active = createUser({ lastActiveAt: daysAgo(3) });

        expect(isInactiveAdmin([invited, active])).toBe(false);
        expect(getLastActiveDescription([invited, active])).toContain('Laatst actief op');
    });
});
