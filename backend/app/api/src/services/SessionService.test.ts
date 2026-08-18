import { Request } from '@simonbackx/simple-endpoints';
import type { Organization, SessionLoginMethod, User } from '@stamhoofd/models';
import { OrganizationFactory, Token, UserFactory } from '@stamhoofd/models';
import type { SessionClient, SessionType } from '@stamhoofd/models/constants/sessions.js';
import { ACCESS_TOKEN_DURATION, SESSION_DURATIONS } from '@stamhoofd/models/constants/sessions.js';
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

    const policy: { name: string; platform: string; client: SessionClient; sessionType: SessionType; loginMethod: SessionLoginMethod; createUser: () => Promise<User> }[] = [
        { name: 'a member in a browser', platform: 'web', client: 'browser', sessionType: 'user', loginMethod: 'password', createUser: () => createMember() },
        { name: 'a member in the native app', platform: 'ios', client: 'nativeApp', sessionType: 'user', loginMethod: 'password', createUser: () => createMember() },
        { name: 'an administrator in a browser', platform: 'web', client: 'browser', sessionType: 'admin', loginMethod: 'password', createUser: () => createAdmin() },
        { name: 'an administrator in the native app', platform: 'android', client: 'nativeApp', sessionType: 'admin', loginMethod: 'password', createUser: () => createAdmin() },
        { name: 'a platform administrator in a browser', platform: 'web', client: 'browser', sessionType: 'platformAdmin', loginMethod: 'password', createUser: () => createPlatformAdmin() },
        { name: 'a platform administrator in the native app', platform: 'ios', client: 'nativeApp', sessionType: 'platformAdmin', loginMethod: 'password', createUser: () => createPlatformAdmin() },
        { name: 'an SSO login in a browser', platform: 'web', client: 'browser', sessionType: 'sso', loginMethod: 'sso', createUser: () => createMember() },
        { name: 'an SSO login in the native app', platform: 'ios', client: 'nativeApp', sessionType: 'sso', loginMethod: 'sso', createUser: () => createAdmin() },
    ];

    describe('session length', () => {
        for (const { name, platform, client, sessionType, loginMethod, createUser } of policy) {
            const { session, refreshToken } = SESSION_DURATIONS[sessionType][client];

            test(`${name} may go unused for ${humanDuration(refreshToken)}`, async () => {
                const user = await createUser();
                const token = await onPlatform(platform, () => SessionService.createSession(user, { loginMethod }));

                expectValidFor(token.refreshTokenValidUntil, refreshToken);
            });

            if (session === null) {
                test(`${name} has no maximum length`, async () => {
                    const user = await createUser();
                    const token = await onPlatform(platform, () => SessionService.createSession(user, { loginMethod }));

                    token.sessionStartedAt = new Date(Date.now() - 10 * refreshToken);
                    await token.save();

                    const rotated = await SessionService.rotateSession(token);
                    expectValidFor(rotated.refreshTokenValidUntil, refreshToken);
                });
            } else {
                test(`${name} is signed out after ${humanDuration(session)}`, async () => {
                    const user = await createUser();
                    const token = await onPlatform(platform, () => SessionService.createSession(user, { loginMethod }));

                    token.sessionStartedAt = new Date(Date.now() - session + HOUR);
                    await token.save();

                    const rotated = await SessionService.rotateSession(token);
                    expectValidFor(rotated.refreshTokenValidUntil, HOUR);
                });
            }
        }

        test('the access token uses the configured duration', async () => {
            const admin = await createAdmin();
            const token = await SessionService.createSession(admin, { loginMethod: 'password' });

            expectValidFor(token.accessTokenValidUntil, ACCESS_TOKEN_DURATION);
        });

        test('the access token never outlives the session', async () => {
            const admin = await createPlatformAdmin();
            const token = await SessionService.createSession(admin, { loginMethod: 'sso' });

            const sessionDuration = SESSION_DURATIONS.sso.browser.session;
            if (sessionDuration === null) {
                throw new Error('Expected browser SSO sessions to have a maximum length');
            }
            token.sessionStartedAt = new Date(Date.now() - sessionDuration + MINUTE);
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
            expectValidFor(rotated.refreshTokenValidUntil, SESSION_DURATIONS.admin.browser.refreshToken);
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
            expectValidFor(rotated.refreshTokenValidUntil, SESSION_DURATIONS.admin.browser.refreshToken);
        });

        test('a member that becomes a platform administrator is limited from that moment on', async () => {
            const user = await createMember();
            const token = await SessionService.createSession(user, { loginMethod: 'password' });
            expectValidFor(token.refreshTokenValidUntil, SESSION_DURATIONS.user.browser.refreshToken);

            const platformAdmin = await createPlatformAdmin();
            token.user.permissions = platformAdmin.permissions;
            await token.user.save();

            const rotated = await SessionService.rotateSession(token);
            expectValidFor(rotated.refreshTokenValidUntil, SESSION_DURATIONS.platformAdmin.browser.refreshToken);
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
            expectValidFor(token.refreshTokenValidUntil, SESSION_DURATIONS.sso.browser.refreshToken);

            const rotated = await SessionService.rotateSession(token);
            expect(rotated.loginMethod).toBe('sso');
            expect(rotated.isAccessTokenExpired()).toBe(false);
        });
    });
});
