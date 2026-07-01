import { Request } from '@simonbackx/simple-endpoints';
import { OrganizationFactory, Token, User, UserFactory } from '@stamhoofd/models';
import { Token as TokenStruct } from '@stamhoofd/structures';

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
});
