import { Request } from '@simonbackx/simple-endpoints';
import type { Organization, User } from '@stamhoofd/models';
import { OrganizationFactory, Token, UserFactory } from '@stamhoofd/models';
import { PermissionLevel, Permissions } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';

import { ContextInstance } from '../helpers/Context.js';
import { SessionService } from './SessionService.js';

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

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

    describe('maximum session length', () => {
        test('a user without permissions keeps a long lived session', async () => {
            const user = await new UserFactory({ organization }).create();
            const token = await SessionService.createSession(user, { loginMethod: 'password' });

            expectValidFor(token.refreshTokenValidUntil, 365 * DAY);
        });

        test('an organization administrator is signed out after 90 days', async () => {
            const admin = await createAdmin();
            const token = await SessionService.createSession(admin, { loginMethod: 'password' });

            token.sessionStartedAt = new Date(Date.now() - 89 * DAY);
            await token.save();

            const rotated = await SessionService.rotateSession(token);
            expectValidFor(rotated.refreshTokenValidUntil, 1 * DAY);
        });

        test('a platform administrator is signed out after 30 days', async () => {
            const admin = await createPlatformAdmin();
            const token = await SessionService.createSession(admin, { loginMethod: 'password' });

            token.sessionStartedAt = new Date(Date.now() - 29 * DAY);
            await token.save();

            const rotated = await SessionService.rotateSession(token);
            expectValidFor(rotated.refreshTokenValidUntil, 1 * DAY);
        });

        test('an administrator that signed in through SSO is signed out after a week', async () => {
            const admin = await createPlatformAdmin();
            const token = await SessionService.createSession(admin, { loginMethod: 'sso' });

            expectValidFor(token.refreshTokenValidUntil, 7 * DAY);
            expectValidFor(token.accessTokenValidUntil, 1 * HOUR);

            token.sessionStartedAt = new Date(Date.now() - 6 * DAY);
            await token.save();

            const rotated = await SessionService.rotateSession(token);
            expectValidFor(rotated.refreshTokenValidUntil, 1 * DAY);
        });

        test('the access token never outlives the session', async () => {
            const admin = await createPlatformAdmin();
            const token = await SessionService.createSession(admin, { loginMethod: 'sso' });

            token.sessionStartedAt = new Date(Date.now() - 7 * DAY + 60 * 1000);
            await token.save();

            const rotated = await SessionService.rotateSession(token);
            expectValidFor(rotated.accessTokenValidUntil, 60 * 1000);
        });

        test('a session in the native app is not limited', async () => {
            const admin = await createPlatformAdmin();
            const token = await onPlatform('ios', () => SessionService.createSession(admin, { loginMethod: 'password' }));

            expect(token.isNativeApp).toBe(true);
            expectValidFor(token.refreshTokenValidUntil, 365 * DAY);
        });

        test('a session in the browser of a mobile device is limited', async () => {
            const admin = await createPlatformAdmin();
            const token = await onPlatform('web', () => SessionService.createSession(admin, { loginMethod: 'password' }));

            expect(token.isNativeApp).toBe(false);
            expectValidFor(token.refreshTokenValidUntil, 7 * DAY);
        });
    });

    describe('inactivity', () => {
        test('an administrator is signed out after a week without renewing', async () => {
            const admin = await createAdmin();
            const token = await SessionService.createSession(admin, { loginMethod: 'password' });

            expectValidFor(token.refreshTokenValidUntil, 7 * DAY);
        });

        test('renewing the access token moves the inactivity limit', async () => {
            const admin = await createAdmin();
            const token = await SessionService.createSession(admin, { loginMethod: 'password' });

            token.refreshTokenValidUntil = new Date(Date.now() + 60 * 1000);
            await token.save();

            const rotated = await SessionService.rotateSession(token);
            expectValidFor(rotated.refreshTokenValidUntil, 7 * DAY);
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
            expectValidFor(rotated.refreshTokenValidUntil, 7 * DAY);
        });

        test('a user that becomes an administrator is limited from that moment on', async () => {
            const user = await new UserFactory({ organization }).create();
            const token = await SessionService.createSession(user, { loginMethod: 'password' });
            expectValidFor(token.refreshTokenValidUntil, 365 * DAY);

            const admin = await createAdmin();
            token.user.permissions = admin.permissions;
            await token.user.save();

            const rotated = await SessionService.rotateSession(token);
            expectValidFor(rotated.refreshTokenValidUntil, 7 * DAY);
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

        test('an expired session does not end the other sessions of the user', async () => {
            const admin = await createAdmin();
            const expired = await SessionService.createSession(admin, { loginMethod: 'password' });
            const other = await SessionService.createSession(admin, { loginMethod: 'password' });

            expired.refreshTokenValidUntil = new Date(Date.now() - 1000);
            await expired.save();

            await Token.getByRefreshToken(expired.refreshToken);

            expect(await Token.getByAccessToken(expired.accessToken)).toBeUndefined();
            expect(await Token.getByAccessToken(other.accessToken)).toBeDefined();
        });
    });

    describe('SSO sessions', () => {
        test('the session still has to be renewed before it can be used', async () => {
            const admin = await createAdmin();
            const token = await SessionService.createExpiredSession(admin, { loginMethod: 'sso' });

            expect(token.isAccessTokenExpired()).toBe(true);
            expectValidFor(token.refreshTokenValidUntil, 7 * DAY);

            const rotated = await SessionService.rotateSession(token);
            expect(rotated.loginMethod).toBe('sso');
            expect(rotated.isAccessTokenExpired()).toBe(false);
        });
    });
});
