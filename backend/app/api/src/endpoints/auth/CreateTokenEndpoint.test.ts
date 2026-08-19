import { Request } from '@simonbackx/simple-endpoints';
import type { Organization } from '@stamhoofd/models';
import { OrganizationFactory, Token, User, UserFactory, UserSession } from '@stamhoofd/models';
import { SESSION_DURATIONS } from '@stamhoofd/models/constants/sessions.js';
import { PermissionLevel, Permissions, SessionClientType, Token as TokenStruct } from '@stamhoofd/structures';

import { testServer } from '../../../tests/helpers/TestServer.js';
import { CreateTokenEndpoint } from './CreateTokenEndpoint.js';

describe('Endpoint.CreateToken', () => {
    // Test endpoint
    const endpoint = new CreateTokenEndpoint();

    test('Can get a token via password flow', async () => {
        const organization = await new OrganizationFactory({}).create();
        // Also check UTF8 passwords
        const password = '54😂test👌🏾86s&é';
        const user = await new UserFactory({ organization, password }).create();

        const r = Request.buildJson('POST', '/oauth/token', organization.getApiHost(), {
            grant_type: 'password',
            username: user.email,
            password: password,
        });

        const response = await testServer.test(endpoint, r);
        expect(response.body).toBeDefined();

        if (!(response.body instanceof TokenStruct)) {
            throw new Error('Expected TokenStruct');
        }

        // Check token is valid
        const token = await Token.getByAccessToken(response.body.accessToken);
        expect(token).toBeDefined();

        const byRefresh = await Token.getByRefreshToken(response.body.refreshToken);
        expect(byRefresh).toBeDefined();
    });

    test('Can get a token via refresh flow', async () => {
        const organization = await new OrganizationFactory({}).create();
        // Also check UTF8 passwords
        const password = '54😂test👌🏾86s&é';
        const user = await new UserFactory({ organization, password }).create();
        const token = await Token.createToken(user);

        const r = Request.buildJson('POST', '/oauth/token', organization.getApiHost(), {
            grant_type: 'refresh_token',
            refresh_token: token.refreshToken,
        });

        const response = await testServer.test(endpoint, r);
        expect(response.body).toBeDefined();

        if (!(response.body instanceof TokenStruct)) {
            throw new Error('Expected TokenStruct');
        }

        expect(response.body.accessToken).not.toEqual(token.accessToken);
        expect(response.body.refreshToken).not.toEqual(token.refreshToken);

        // Check token is valid
        const byAccess = await Token.getByAccessToken(response.body.accessToken);
        expect(byAccess).toBeDefined();

        const byRefresh = await Token.getByRefreshToken(response.body.refreshToken);
        expect(byRefresh).toBeDefined();
    });

    describe('last activity', () => {
        const password = 'test-password-1234';

        async function getLastActiveAt(user: User): Promise<Date | null> {
            const updated = await User.getByID(user.id);
            return updated!.lastActiveAt;
        }

        test('a password login marks the user as active', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password }).create();
            expect(user.lastActiveAt).toBeNull();

            const r = Request.buildJson('POST', '/oauth/token', organization.getApiHost(), {
                grant_type: 'password',
                username: user.email,
                password,
            });
            await testServer.test(endpoint, r);

            const lastActiveAt = await getLastActiveAt(user);
            expect(lastActiveAt).not.toBeNull();
            expect(lastActiveAt!.getTime()).toBeGreaterThan(Date.now() - 60 * 1000);
        });

        test('refreshing a token marks the user as active again', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password }).create();
            const token = await Token.createToken(user);

            const monthsAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
            monthsAgo.setMilliseconds(0);
            user.lastActiveAt = monthsAgo;
            await user.save();

            const r = Request.buildJson('POST', '/oauth/token', organization.getApiHost(), {
                grant_type: 'refresh_token',
                refresh_token: token.refreshToken,
            });
            await testServer.test(endpoint, r);

            const lastActiveAt = await getLastActiveAt(user);
            expect(lastActiveAt!.getTime()).toBeGreaterThan(Date.now() - 60 * 1000);
        });

        test('a failed login does not mark the user as active', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password }).create();

            const r = Request.buildJson('POST', '/oauth/token', organization.getApiHost(), {
                grant_type: 'password',
                username: user.email,
                password: 'wrong-password',
            });
            await expect(testServer.test(endpoint, r)).rejects.toThrow();

            expect(await getLastActiveAt(user)).toBeNull();
        });
    });

    describe('session length', () => {
        const password = 'test-password-1234';
        const DAY = 24 * 60 * 60 * 1000;

        function expectValidFor(date: Date, duration: number) {
            expect(date.getTime()).toBeGreaterThan(Date.now() + duration - 5000);
            expect(date.getTime()).toBeLessThanOrEqual(Date.now() + duration);
        }

        async function login(organization: Organization, user: User, platform: string | null = null): Promise<Token> {
            const r = Request.buildJson('POST', '/oauth/token', organization.getApiHost(), {
                grant_type: 'password',
                username: user.email,
                password,
            });
            if (platform) {
                r.headers['x-platform'] = platform;
            }

            const response = await testServer.test(endpoint, r);
            if (!(response.body instanceof TokenStruct)) {
                throw new Error('Expected TokenStruct');
            }

            const token = await Token.getByAccessToken(response.body.accessToken);
            expect(token).toBeDefined();
            return token!;
        }

        async function refresh(organization: Organization, refreshToken: string): Promise<Token> {
            const r = Request.buildJson('POST', '/oauth/token', organization.getApiHost(), {
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
            });

            const response = await testServer.test(endpoint, r);
            if (!(response.body instanceof TokenStruct)) {
                throw new Error('Expected TokenStruct');
            }

            const token = await Token.getByAccessToken(response.body.accessToken);
            expect(token).toBeDefined();
            return token!;
        }

        async function getSession(token: Token): Promise<UserSession> {
            const session = await UserSession.getByID(token.sessionId);
            if (!session) throw new Error('Expected user session');
            return session;
        }

        test('an administrator that signs in in a browser gets a limited session', async () => {
            const organization = await new OrganizationFactory({}).create();
            const admin = await new UserFactory({
                organization,
                password,
                permissions: Permissions.create({ level: PermissionLevel.Full }),
            }).create();

            const token = await login(organization, admin, 'web');

            expect((await getSession(token)).clientType).toBe(SessionClientType.Browser);
            expectValidFor(token.refreshTokenValidUntil, SESSION_DURATIONS.admin[SessionClientType.Browser].refreshToken);
        });

        test('an administrator that signs in in the native app has no maximum session length', async () => {
            const organization = await new OrganizationFactory({}).create();
            const admin = await new UserFactory({
                organization,
                password,
                permissions: Permissions.create({ level: PermissionLevel.Full }),
            }).create();

            const token = await login(organization, admin, 'ios');

            expect((await getSession(token)).clientType).toBe(SessionClientType.iOS);
            expectValidFor(token.refreshTokenValidUntil, SESSION_DURATIONS.admin[SessionClientType.iOS].refreshToken);

            const browserSessionDuration = SESSION_DURATIONS.admin[SessionClientType.Browser].session;
            if (browserSessionDuration === null) {
                throw new Error('Expected browser administrator sessions to have a maximum length');
            }
            const userSession = await getSession(token);
            userSession.startedAt = new Date(Date.now() - 2 * browserSessionDuration);
            await userSession.save();

            const renewed = await refresh(organization, token.refreshToken);
            expectValidFor(renewed.refreshTokenValidUntil, SESSION_DURATIONS.admin[SessionClientType.iOS].refreshToken);
        });

        test('renewing an access token does not extend the session past its maximum length', async () => {
            const organization = await new OrganizationFactory({}).create();
            const admin = await new UserFactory({
                organization,
                password,
                permissions: Permissions.create({ level: PermissionLevel.Full }),
            }).create();

            const token = await login(organization, admin, 'web');

            const sessionDuration = SESSION_DURATIONS.admin[SessionClientType.Browser].session;
            if (sessionDuration === null) {
                throw new Error('Expected browser administrator sessions to have a maximum length');
            }
            const sessionStartedAt = new Date(Date.now() - sessionDuration + DAY);
            sessionStartedAt.setMilliseconds(0);
            const userSession = await getSession(token);
            userSession.startedAt = sessionStartedAt;
            await userSession.save();

            const renewed = await refresh(organization, token.refreshToken);

            expect((await getSession(renewed)).startedAt).toEqual(sessionStartedAt);
            expect(renewed.refreshTokenValidUntil.getTime()).toBeLessThanOrEqual(sessionStartedAt.getTime() + sessionDuration);
            expect(renewed.refreshTokenValidUntil.getTime()).toBeGreaterThan(Date.now());
        });

        test('a session that reached its maximum length cannot be renewed', async () => {
            const organization = await new OrganizationFactory({}).create();
            const admin = await new UserFactory({
                organization,
                password,
                permissions: Permissions.create({ level: PermissionLevel.Full }),
            }).create();

            const token = await login(organization, admin, 'web');
            const sessionDuration = SESSION_DURATIONS.admin[SessionClientType.Browser].session;
            if (sessionDuration === null) {
                throw new Error('Expected browser administrator sessions to have a maximum length');
            }
            const userSession = await getSession(token);
            userSession.startedAt = new Date(Date.now() - sessionDuration - DAY);
            await userSession.save();
            token.refreshTokenValidUntil = new Date(Date.now() + DAY);
            await token.save();

            const otherSession = await login(organization, admin, 'web');

            const r = Request.buildJson('POST', '/oauth/token', organization.getApiHost(), {
                grant_type: 'refresh_token',
                refresh_token: token.refreshToken,
            });

            await expect(testServer.test(endpoint, r)).rejects.toMatchObject({ code: 'invalid_refresh_token' });
            expect(await Token.getByAccessToken(otherSession.accessToken)).toBeDefined();

            await expect(testServer.test(endpoint, r)).rejects.toMatchObject({ code: 'invalid_refresh_token' });
            expect(await Token.getByAccessToken(otherSession.accessToken)).toBeDefined();
        });
    });
});
