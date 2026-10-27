import { Request } from '@node/endpoints';
import { OrganizationFactory, Token, UserFactory } from '@stamhoofd/models';
import { PermissionLevel } from '@stamhoofd/types/PermissionLevel';
import { BuckarooSettings, Organization, Permissions, Version } from '@stamhoofd/structures';
import { SessionService } from '../../../../services/SessionService.js';

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
        const token = await SessionService.createSession(user);

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

        const token = await SessionService.createSession(user);

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

    test('The Buckaroo secret is not returned to admins', async () => {
        const organization = await new OrganizationFactory({}).create();
        organization.privateMeta.buckarooSettings = BuckarooSettings.create({ key: 'website-key', secret: 'buckaroo-secret' });
        await organization.save();

        const user = await new UserFactory({
            organization,
            permissions: Permissions.create({
                level: PermissionLevel.Read,
            }),
        }).create();
        const token = await SessionService.createSession(user);

        const r = Request.buildJson('GET', '/v3/organization', organization.getApiHost());
        r.headers.authorization = 'Bearer ' + token.accessToken;

        const response = await testServer.test(endpoint, r);
        expect(response.body.privateMeta?.buckarooSettings?.key).toEqual('website-key');
        expect(response.body.privateMeta?.buckarooSettings?.secret).toEqual(BuckarooSettings.placeholderSecret);
        expect(JSON.stringify(response.body.encode({ version: Version }))).not.toContain('buckaroo-secret');
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

        const token = await SessionService.createSession(user);

        const r = Request.buildJson('GET', '/v3/organization', organization.getApiHost());
        r.headers.authorization = 'Bearer ' + token.accessToken;

        const response = await testServer.test(endpoint, r);
        expect(response.body).toBeDefined();
        expect(response.body.privateMeta).toEqual(null);
    });
});
