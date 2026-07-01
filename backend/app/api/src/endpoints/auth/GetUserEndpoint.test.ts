import { Request } from '@simonbackx/simple-endpoints';
import { MemberFactory, OrganizationFactory, Token, UserFactory } from '@stamhoofd/models';

import { MFATestHelper } from '../../../tests/helpers/MFATestHelper.js';
import { testServer } from '../../../tests/helpers/TestServer.js';
import { GetUserEndpoint } from './GetUserEndpoint.js';
import { STExpect } from '@stamhoofd/test-utils';

describe('Endpoint.GetUser', () => {
    // Test endpoint
    const endpoint = new GetUserEndpoint();

    test('Request user details when signed in', async () => {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({ organization }).create();
        const token = await Token.createToken(user);

        const r = Request.buildJson('GET', '/v1/user', organization.getApiHost());
        r.headers.authorization = 'Bearer ' + token.accessToken;

        const response = await testServer.test(endpoint, r);
        expect(response.body).toBeDefined();
        expect(response.body.id).toEqual(user.id);
    });

    test('Two-factor authentication is reported on the user and on the accounts of a member', async () => {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({ organization }).create();
        await new MemberFactory({ organization, user }).create();
        await MFATestHelper.addConfirmedTOTP(user);

        const token = await Token.createToken(user);
        const r = Request.buildJson('GET', '/v1/user', organization.getApiHost());
        r.headers.authorization = 'Bearer ' + token.accessToken;

        const response = await testServer.test(endpoint, r);
        expect(response.body.hasTwoFactor).toBe(true);

        // The same flag is what MemberAccountBox shows for every account of a member.
        const member = response.body.members.members.find(m => m.users.some(u => u.id === user.id));
        expect(member?.users.find(u => u.id === user.id)?.hasTwoFactor).toBe(true);
    });

    test('A user without a second factor is not reported as having two-factor authentication', async () => {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({ organization }).create();
        const token = await Token.createToken(user);

        const r = Request.buildJson('GET', '/v1/user', organization.getApiHost());
        r.headers.authorization = 'Bearer ' + token.accessToken;

        const response = await testServer.test(endpoint, r);
        expect(response.body.hasTwoFactor).toBe(false);
    });

    test('Request user details when not signed in is not working', async () => {
        const organization = await new OrganizationFactory({}).create();
        const r = Request.buildJson('GET', '/v1/user', organization.getApiHost());
        await expect(testServer.test(endpoint, r)).rejects.toThrow(/missing/i);
    });

    test('Request user details with invalid token is not working', async () => {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({ organization }).create();
        const token = await Token.createToken(user);

        const r = Request.buildJson('GET', '/v1/user', organization.getApiHost());
        r.headers.authorization = 'Bearer ' + token.accessToken + 'd';

        await expect(testServer.test(endpoint, r)).rejects.toThrow(/invalid/i);
    });

    test('Request user details with expired token is not working', async () => {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({ organization }).create();
        const token = await Token.createExpiredToken(user);

        const r = Request.buildJson('GET', '/v1/user', organization.getApiHost());
        r.headers.authorization = 'Bearer ' + token.accessToken;

        await expect(testServer.test(endpoint, r)).rejects.toThrow(/expired/i);
    });

    test('Can request details of an API user by token without knowing the organization scope', async () => {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({ organization, apiUser: true }).create();
        const token = await Token.createToken(user);

        const r = Request.buildJson('GET', '/v1/user');
        r.headers.authorization = 'Bearer ' + token.accessToken;

        const response = await testServer.test(endpoint, r);
        expect(response.body).toBeDefined();
        expect(response.body.id).toEqual(user.id);
        expect(response.body.organizationId).toEqual(organization.id);
    });

    test('Cannot request details of an normal user by token without knowing the organization scope', async () => {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({ organization }).create();
        const token = await Token.createToken(user);

        const r = Request.buildJson('GET', '/v1/user');
        r.headers.authorization = 'Bearer ' + token.accessToken;

        await expect(testServer.test(endpoint, r)).rejects.toThrow(STExpect.simpleError({
            code: 'invalid_access_token'
        }));
    });

    test('Cannot request details of an API user by token with wrong organization scope', async () => {
        const wrongOrganization = await new OrganizationFactory({}).create();
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({ organization, apiUser: true }).create();
        const token = await Token.createToken(user);

        const r = Request.buildJson('GET', '/v1/user', wrongOrganization.getApiHost());
        r.headers.authorization = 'Bearer ' + token.accessToken;

        await expect(testServer.test(endpoint, r)).rejects.toThrow(STExpect.simpleError({
            code: 'invalid_access_token'
        }));
    });

});
