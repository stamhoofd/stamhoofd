import { Request } from '@simonbackx/simple-endpoints';
import type { Organization, SessionLoginMethod, User } from '@stamhoofd/models';
import { OrganizationFactory, Token, UserFactory } from '@stamhoofd/models';
import { PermissionLevel, Permissions } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';

import { ContextInstance } from '../helpers/Context.js';
import { SessionService } from './SessionService.js';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function humanDuration(duration: number): string {
    return duration % DAY === 0 ? `${duration / DAY} days` : `${duration / HOUR} hours`;
}

/**
 * Run inside a request context, so the service sees the platform the request came from.
 */
async function onPlatform<T>(platform: string, handler: () => Promise<T>): Promise<T> {
    const request = new Request({ method: 'POST', url: '/oauth/token', host: 'api.example.com', headers: { 'x-platform': platform } });
    return await ContextInstance.start(request, handler);
}

function expectValidFor(date: Date, duration: number) {
    // A second of leeway: the token is created a moment before this runs.
    expect(date.getTime()).toBeGreaterThan(Date.now() + duration - 5000);
    expect(date.getTime()).toBeLessThanOrEqual(Date.now() + duration);
}

describe('SessionService', () => {
    let organization: Organization;

    beforeEach(async () => {
        TestUtils.setEnvironment('userMode', 'platform');
        organization = await new OrganizationFactory({}).create();
    });

    async function createMember(): Promise<User> {
        return await new UserFactory({ organization }).create();
    }

    async function createAdmin(): Promise<User> {
        return await new UserFactory({
            organization,
            permissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();
    }

    async function createPlatformAdmin(): Promise<User> {
        return await new UserFactory({
            globalPermissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();
    }

    /**
     * The policy itself, written out instead of read from SESSION_DURATIONS: a test that
     * takes its expectations from the constants it checks would accept any change to them.
     */
    const policy: { name: string; platform: string; loginMethod: SessionLoginMethod; createUser: () => Promise<User>; session: number; refreshToken: number }[] = [
        { name: 'a member in a browser', platform: 'web', loginMethod: 'password', createUser: () => createMember(), session: 14 * DAY, refreshToken: 3 * DAY },
        { name: 'a member in the native app', platform: 'ios', loginMethod: 'password', createUser: () => createMember(), session: 90 * DAY, refreshToken: 30 * DAY },
        { name: 'an administrator in a browser', platform: 'web', loginMethod: 'password', createUser: () => createAdmin(), session: 14 * DAY, refreshToken: 3 * DAY },
        { name: 'an administrator in the native app', platform: 'android', loginMethod: 'password', createUser: () => createAdmin(), session: 60 * DAY, refreshToken: 30 * DAY },
        { name: 'a platform administrator in a browser', platform: 'web', loginMethod: 'password', createUser: () => createPlatformAdmin(), session: 12 * HOUR, refreshToken: 3 * HOUR },
        { name: 'a platform administrator in the native app', platform: 'ios', loginMethod: 'password', createUser: () => createPlatformAdmin(), session: 7 * DAY, refreshToken: 36 * HOUR },
        { name: 'an SSO login in a browser', platform: 'web', loginMethod: 'sso', createUser: () => createMember(), session: 12 * HOUR, refreshToken: 3 * HOUR },
        { name: 'an SSO login in the native app', platform: 'ios', loginMethod: 'sso', createUser: () => createAdmin(), session: 7 * DAY, refreshToken: 36 * HOUR },
    ];

    describe('session length', () => {
        for (const { name, platform, loginMethod, createUser, session, refreshToken } of policy) {
            test(`${name} may go unused for ${humanDuration(refreshToken)}`, async () => {
                const user = await createUser();
                const token = await onPlatform(platform, () => SessionService.createSession(user, { loginMethod }));

                expectValidFor(token.refreshTokenValidUntil, refreshToken);
            });

            test(`${name} is signed out after ${humanDuration(session)}`, async () => {
                const user = await createUser();
                const token = await onPlatform(platform, () => SessionService.createSession(user, { loginMethod }));

                // An hour before the session reaches its maximum length: renewing may not
                // hand out a refresh token that outlives it.
                token.sessionStartedAt = new Date(Date.now() - session + HOUR);
                await token.save();

                const rotated = await SessionService.rotateSession(token);
                expectValidFor(rotated.refreshTokenValidUntil, HOUR);
            });
        }

        test('the access token is valid for 15 minutes', async () => {
            const admin = await createAdmin();
            const token = await SessionService.createSession(admin, { loginMethod: 'password' });

            expectValidFor(token.accessTokenValidUntil, 15 * MINUTE);
        });

        test('the access token never outlives the session', async () => {
            const admin = await createPlatformAdmin();
            const token = await SessionService.createSession(admin, { loginMethod: 'sso' });

            token.sessionStartedAt = new Date(Date.now() - 12 * HOUR + MINUTE);
            await token.save();

            const rotated = await SessionService.rotateSession(token);
            expectValidFor(rotated.accessTokenValidUntil, MINUTE);
        });
    });

    describe('inactivity', () => {
        test('renewing the access token moves the inactivity limit', async () => {
            const admin = await createAdmin();
            const token = await SessionService.createSession(admin, { loginMethod: 'password' });

            token.refreshTokenValidUntil = new Date(Date.now() + 60 * 1000);
            await token.save();

            const rotated = await SessionService.rotateSession(token);
            expectValidFor(rotated.refreshTokenValidUntil, 3 * DAY);
        });
    });

    describe('rotation', () => {
        test('the new token continues the same session', async () => {
            const admin = await createAdmin();
            const token = await onPlatform('android', () => SessionService.createSession(admin, { loginMethod: 'sso' }));

            const rotated = await SessionService.rotateSession(token);

            expect(rotated.sessionStartedAt).toEqual(token.sessionStartedAt);
            expect(rotated.loginMethod).toBe('sso');
            expect(rotated.isNativeApp).toBe(true);
        });

        test('the platform of the login is kept, not the one of the rotation', async () => {
            const admin = await createAdmin();
            const token = await SessionService.createSession(admin, { loginMethod: 'password' });

            const rotated = await onPlatform('ios', () => SessionService.rotateSession(token));

            expect(rotated.isNativeApp).toBe(false);
            expectValidFor(rotated.refreshTokenValidUntil, 3 * DAY);
        });

        test('a member that becomes a platform administrator is limited from that moment on', async () => {
            const user = await createMember();
            const token = await SessionService.createSession(user, { loginMethod: 'password' });
            expectValidFor(token.refreshTokenValidUntil, 3 * DAY);

            const platformAdmin = await createPlatformAdmin();
            token.user.permissions = platformAdmin.permissions;
            await token.user.save();

            const rotated = await SessionService.rotateSession(token);
            expectValidFor(rotated.refreshTokenValidUntil, 3 * HOUR);
        });
    });

    describe('expired sessions', () => {
        test('an expired session cannot be renewed', async () => {
            const admin = await createAdmin();
            const token = await SessionService.createSession(admin, { loginMethod: 'password' });

            token.refreshTokenValidUntil = new Date(Date.now() - 1000);
            await token.save();

            expect(await Token.getByRefreshToken(token.refreshToken)).toBeUndefined();
        });

        test('an expired refresh token ends every session of the user', async () => {
            const admin = await createAdmin();
            const expired = await SessionService.createSession(admin, { loginMethod: 'password' });
            const other = await SessionService.createSession(admin, { loginMethod: 'password' });

            expired.refreshTokenValidUntil = new Date(Date.now() - 1000);
            await expired.save();

            // Using an expired refresh token can mean the token was stolen, so the account
            // is signed out everywhere instead of only on this session.
            await Token.getByRefreshToken(expired.refreshToken);

            expect(await Token.getByAccessToken(expired.accessToken)).toBeUndefined();
            expect(await Token.getByAccessToken(other.accessToken)).toBeUndefined();
        });
    });

    describe('SSO sessions', () => {
        test('the session still has to be renewed before it can be used', async () => {
            const admin = await createAdmin();
            const token = await SessionService.createExpiredSession(admin, { loginMethod: 'sso' });

            expect(token.isAccessTokenExpired()).toBe(true);
            expectValidFor(token.refreshTokenValidUntil, 3 * HOUR);

            const rotated = await SessionService.rotateSession(token);
            expect(rotated.loginMethod).toBe('sso');
            expect(rotated.isAccessTokenExpired()).toBe(false);
        });
    });
});
