import { Request } from '@simonbackx/simple-endpoints';
import { OrganizationFactory, Token, UserFactory } from '@stamhoofd/models';
import { Organization, PermissionLevel, Permissions } from '@stamhoofd/structures';

import { TestUtils } from '@stamhoofd/test-utils';
import { testServer } from '../../../../../tests/helpers/TestServer.js';
import { GetOrganizationEndpoint } from './GetOrganizationEndpoint.js';

describe('Endpoint.GetOrganization', () => {
    // Test endpoint
    const endpoint = new GetOrganizationEndpoint();

    beforeEach(async () => {
        TestUtils.setEnvironment('userMode', 'platform');
    });

    test('Get organization as signed in user', async () => {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({ organization }).create();
        const token = await Token.createToken(user);

        const r = Request.buildJson('GET', '/v3/organization', organization.getApiHost());
        r.headers.authorization = 'Bearer ' + token.accessToken;

        const response = await testServer.test(endpoint, r);
        expect(response.body).toBeDefined();

        if (!(response.body instanceof Organization)) {
            throw new Error('Expected Organization');
        }

        expect(response.body.id).toEqual(organization.id);
        expect(response.body.privateMeta).toEqual(null);
    });

    test('Get organization as admin', async () => {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({
            organization,
            permissions: Permissions.create({
                level: PermissionLevel.Read,
            }),
        }).create();

        const token = await Token.createToken(user);

        const r = Request.buildJson('GET', '/v3/organization', organization.getApiHost());
        r.headers.authorization = 'Bearer ' + token.accessToken;

        const response = await testServer.test(endpoint, r);
        expect(response.body).toBeDefined();

        if (!(response.body instanceof Organization)) {
            throw new Error('Expected Organization');
        }

        expect(response.body.id).toEqual(organization.id);
        expect(response.body.privateMeta).not.toEqual(null);
    });

    test('Get organization as admin of a different organization', async () => {
        const organization = await new OrganizationFactory({}).create();
        const organization2 = await new OrganizationFactory({}).create();
        const user = await new UserFactory({
            organization: organization2,
            permissions: Permissions.create({
                level: PermissionLevel.Read,
            }),
        }).create();

        const token = await Token.createToken(user);

        const r = Request.buildJson('GET', '/v3/organization', organization.getApiHost());
        r.headers.authorization = 'Bearer ' + token.accessToken;

        const response = await testServer.test(endpoint, r);
        expect(response.body).toBeDefined();
        expect(response.body.privateMeta).toEqual(null);
    });
});
