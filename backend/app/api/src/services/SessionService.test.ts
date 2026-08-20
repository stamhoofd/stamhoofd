import { Request } from '@simonbackx/simple-endpoints';
import type { Organization, User } from '@stamhoofd/models';
import { OrganizationFactory, Token, UserFactory, UserSession } from '@stamhoofd/models';
import type { SessionType } from '@stamhoofd/models/constants/sessions.js';
import { ACCESS_TOKEN_DURATION, SESSION_DURATIONS, SSO_HANDOFF_TOKEN_DURATION } from '@stamhoofd/models/constants/sessions.js';
import { PermissionLevel, Permissions, SessionClientType, SessionDeviceType, SessionLoginMethod, SessionOS } from '@stamhoofd/structures';
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

    async function getSession(token: Token): Promise<UserSession> {
        const session = await UserSession.getByID(token.sessionId);
        if (!session) throw new Error('Expected user session');
        return session;
    }

    const policy: { name: string; platform: string; clientType: SessionClientType; sessionType: SessionType; loginMethod: SessionLoginMethod; createUser: () => Promise<User> }[] = [
        { name: 'a member in a browser', platform: 'web', clientType: SessionClientType.Browser, sessionType: 'user', loginMethod: SessionLoginMethod.Password, createUser: () => createMember() },
        { name: 'a member in the native app', platform: 'ios', clientType: SessionClientType.iOS, sessionType: 'user', loginMethod: SessionLoginMethod.Password, createUser: () => createMember() },
        { name: 'an administrator in a browser', platform: 'web', clientType: SessionClientType.Browser, sessionType: 'admin', loginMethod: SessionLoginMethod.Password, createUser: () => createAdmin() },
        { name: 'an administrator in the native app', platform: 'android', clientType: SessionClientType.Android, sessionType: 'admin', loginMethod: SessionLoginMethod.Password, createUser: () => createAdmin() },
        { name: 'a platform administrator in a browser', platform: 'web', clientType: SessionClientType.Browser, sessionType: 'platformAdmin', loginMethod: SessionLoginMethod.Password, createUser: () => createPlatformAdmin() },
        { name: 'a platform administrator in the native app', platform: 'ios', clientType: SessionClientType.iOS, sessionType: 'platformAdmin', loginMethod: SessionLoginMethod.Password, createUser: () => createPlatformAdmin() },
        { name: 'an SSO login in a browser', platform: 'web', clientType: SessionClientType.Browser, sessionType: 'sso', loginMethod: SessionLoginMethod.SSO, createUser: () => createMember() },
        { name: 'an SSO login in the native app', platform: 'ios', clientType: SessionClientType.iOS, sessionType: 'sso', loginMethod: SessionLoginMethod.SSO, createUser: () => createAdmin() },
    ];

    test('creates and persists a token with its session', async () => {
        const user = await createMember();
        const token = await SessionService.createSession(user);

        expect(token).toBeInstanceOf(Token);
        expect(token.user).toBe(user);
        expect(token.userId).toBe(user.id);
        expect(token.accessToken).toHaveLength(256);
        expect(token.refreshToken).toHaveLength(256);

        const session = await getSession(token);
        expect(session).toMatchObject({
            userId: user.id,
            lastUsedTokenId: token.id,
            lastActiveTokenId: token.id,
            clientType: SessionClientType.Browser,
            loginMethod: SessionLoginMethod.Password,
        });
        expect(await Token.getByAccessToken(token.accessToken)).toMatchObject({
            id: token.id,
            sessionId: session.id,
            refreshToken: token.refreshToken,
        });
    });

    describe('session length', () => {
        for (const { name, platform, clientType, sessionType, loginMethod, createUser } of policy) {
            const { session, refreshToken } = SESSION_DURATIONS[sessionType][clientType];

            test(`${name} may go unused for ${humanDuration(refreshToken)}`, async () => {
                const user = await createUser();
                const token = await onPlatform(platform, () => SessionService.createSession(user, { loginMethod }));

                expectValidFor(token.refreshTokenValidUntil, refreshToken);
            });

            if (session === null) {
                test(`${name} has no maximum length`, async () => {
                    const user = await createUser();
                    const token = await onPlatform(platform, () => SessionService.createSession(user, { loginMethod }));

                    const userSession = await getSession(token);
                    userSession.startedAt = new Date(Date.now() - 10 * refreshToken);
                    await userSession.save();

                    const rotated = await SessionService.rotateSession(token);
                    expectValidFor(rotated.refreshTokenValidUntil, refreshToken);
                });
            } else {
                test(`${name} is signed out after ${humanDuration(session)}`, async () => {
                    const user = await createUser();
                    const token = await onPlatform(platform, () => SessionService.createSession(user, { loginMethod }));

                    const userSession = await getSession(token);
                    userSession.startedAt = new Date(Date.now() - session + HOUR);
                    await userSession.save();

                    const rotated = await SessionService.rotateSession(token);
                    expectValidFor(rotated.refreshTokenValidUntil, HOUR);
                });
            }
        }

        test('the access token uses the configured duration', async () => {
            const admin = await createAdmin();
            const token = await SessionService.createSession(admin, { loginMethod: SessionLoginMethod.Password });

            expectValidFor(token.accessTokenValidUntil, ACCESS_TOKEN_DURATION);
        });

        test('the access token never outlives the session', async () => {
            const admin = await createPlatformAdmin();
            const token = await SessionService.createSession(admin, { loginMethod: SessionLoginMethod.SSO });

            const sessionDuration = SESSION_DURATIONS.sso[SessionClientType.Browser].session;
            if (sessionDuration === null) {
                throw new Error('Expected browser SSO sessions to have a maximum length');
            }
            const userSession = await getSession(token);
            userSession.startedAt = new Date(Date.now() - sessionDuration + MINUTE);
            await userSession.save();

            const rotated = await SessionService.rotateSession(token);
            expectValidFor(rotated.accessTokenValidUntil, MINUTE);
        });
    });

    describe('inactivity', () => {
        test('renewing the access token moves the inactivity limit', async () => {
            const admin = await createAdmin();
            const token = await SessionService.createSession(admin, { loginMethod: SessionLoginMethod.Password });

            token.refreshTokenValidUntil = new Date(Date.now() + 60 * 1000);
            await token.save();

            const rotated = await SessionService.rotateSession(token);
            expectValidFor(rotated.refreshTokenValidUntil, SESSION_DURATIONS.admin[SessionClientType.Browser].refreshToken);
        });
    });

    describe('rotation', () => {
        test('the new token continues the same session', async () => {
            const admin = await createAdmin();
            const token = await onPlatform('android', () => SessionService.createSession(admin, { loginMethod: SessionLoginMethod.SSO }));

            const rotated = await SessionService.rotateSession(token);
            const session = await getSession(rotated);
            expect(rotated.sessionId).toBe(token.sessionId);
            expect(session.loginMethod).toBe(SessionLoginMethod.SSO);
            expect(session.clientType).toBe(SessionClientType.Android);
        });

        test('the platform of the login is kept, not the one of the rotation', async () => {
            const admin = await createAdmin();
            const token = await SessionService.createSession(admin, { loginMethod: SessionLoginMethod.Password });

            const rotated = await onPlatform('ios', () => SessionService.rotateSession(token));

            expect((await getSession(rotated)).clientType).toBe(SessionClientType.Browser);
            expectValidFor(rotated.refreshTokenValidUntil, SESSION_DURATIONS.admin[SessionClientType.Browser].refreshToken);
        });

        test('a replacement only retires the previous token after it becomes active', async () => {
            const admin = await createAdmin();
            const original = await SessionService.createSession(admin, { loginMethod: SessionLoginMethod.Password });
            const replacement = await SessionService.rotateSession(original);
            let session = await getSession(original);

            expect(session.lastActiveTokenId).toBe(original.id);
            expect(session.lastUsedTokenId).toBe(replacement.id);
            expect(await Token.getByAccessToken(original.accessToken)).toBeDefined();

            expect(await SessionService.activateToken(replacement)).toBe(true);
            session = await getSession(replacement);
            expect(session.lastActiveTokenId).toBe(replacement.id);
            expect(await Token.getByAccessToken(original.accessToken)).toBeUndefined();
            expect(await SessionService.activateToken(original)).toBe(false);
        });

        test('the active token can retry a renewal whose response was lost', async () => {
            const admin = await createAdmin();
            const original = await SessionService.createSession(admin, { loginMethod: SessionLoginMethod.Password });
            const lostReplacement = await SessionService.rotateSession(original);
            const retryReplacement = await SessionService.rotateSession(original);

            expect(retryReplacement.sessionId).toBe(original.sessionId);
            expect(await Token.getByAccessToken(lostReplacement.accessToken)).toBeUndefined();
            expect(await Token.getByAccessToken(original.accessToken)).toBeDefined();
        });

        test('renewal updates versions but keeps stable device metadata', async () => {
            const admin = await createAdmin();
            const initial = encodeURIComponent(JSON.stringify({
                deviceType: SessionDeviceType.Phone,
                deviceName: 'iPhone 15 Pro',
                osName: SessionOS.iOS,
                osVersion: '18.1',
                appVersion: '2.0',
                nativeAppVersion: '1.0',
                browserName: null,
            }));
            const token = await ContextInstance.start(new Request({ method: 'POST', url: '/oauth/token', host: 'api.example.com', headers: { 'x-platform': 'ios', 'x-session-metadata': initial } }), () => SessionService.createSession(admin, { loginMethod: SessionLoginMethod.Password }));

            const changed = encodeURIComponent(JSON.stringify({
                deviceType: SessionDeviceType.Desktop,
                deviceName: 'Changed',
                osName: SessionOS.Windows,
                osVersion: '18.2',
                appVersion: '2.1',
                nativeAppVersion: '1.1',
                browserName: 'Other',
            }));
            await ContextInstance.start(new Request({ method: 'POST', url: '/oauth/token', host: 'api.example.com', headers: { 'x-platform': 'web', 'x-session-metadata': changed } }), () => SessionService.rotateSession(token));

            const session = await getSession(token);
            expect(session).toMatchObject({
                clientType: SessionClientType.iOS,
                deviceType: SessionDeviceType.Phone,
                deviceName: 'iPhone 15 Pro',
                osName: SessionOS.iOS,
                osVersion: '18.2',
                appVersion: '2.1',
                nativeAppVersion: '1.1',
                browserName: null,
            });
        });

        test('a member that becomes a platform administrator is limited from that moment on', async () => {
            const user = await createMember();
            const token = await SessionService.createSession(user, { loginMethod: SessionLoginMethod.Password });
            expectValidFor(token.refreshTokenValidUntil, SESSION_DURATIONS.user[SessionClientType.Browser].refreshToken);

            const platformAdmin = await createPlatformAdmin();
            token.user.permissions = platformAdmin.permissions;
            await token.user.save();

            const rotated = await SessionService.rotateSession(token);
            expectValidFor(rotated.refreshTokenValidUntil, SESSION_DURATIONS.platformAdmin[SessionClientType.Browser].refreshToken);
        });
    });

    describe('expired sessions', () => {
        test('an expired session cannot be renewed', async () => {
            const admin = await createAdmin();
            const token = await SessionService.createSession(admin, { loginMethod: SessionLoginMethod.Password });

            token.refreshTokenValidUntil = new Date(Date.now() - 1000);
            await token.save();

            expect(await SessionService.getByRefreshToken(token.refreshToken)).toBeUndefined();
        });

        test('an expired refresh token ends every session of the user', async () => {
            const admin = await createAdmin();
            const expired = await SessionService.createSession(admin, { loginMethod: SessionLoginMethod.Password });
            const other = await SessionService.createSession(admin, { loginMethod: SessionLoginMethod.Password });

            expired.refreshTokenValidUntil = new Date(Date.now() - 1000);
            await expired.save();

            // Using an expired refresh token can mean the token was stolen, so the account
            // is signed out everywhere instead of only on this session.
            await SessionService.getByRefreshToken(expired.refreshToken);

            expect(await Token.getByAccessToken(expired.accessToken)).toBeUndefined();
            expect(await Token.getByAccessToken(other.accessToken)).toBeUndefined();
            expect(await UserSession.getByID(expired.sessionId)).toBeUndefined();
            expect(await UserSession.getByID(other.sessionId)).toBeUndefined();
        });
    });

    describe('SSO sessions', () => {
        test('the session still has to be renewed before it can be used', async () => {
            const admin = await createAdmin();
            const token = await SessionService.createSSOHandoff(admin);

            expect(token.isAccessTokenExpired()).toBe(true);
            expectValidFor(token.refreshTokenValidUntil, SSO_HANDOFF_TOKEN_DURATION);

            const rotated = await SessionService.rotateSession(token);
            expect((await getSession(rotated)).loginMethod).toBe(SessionLoginMethod.SSO);
            expect(rotated.isAccessTokenExpired()).toBe(false);
            expectValidFor(rotated.refreshTokenValidUntil, SESSION_DURATIONS.sso[SessionClientType.Browser].refreshToken);
            expect(await SessionService.getByRefreshToken(token.refreshToken)).toBeUndefined();
        });
    });
});
