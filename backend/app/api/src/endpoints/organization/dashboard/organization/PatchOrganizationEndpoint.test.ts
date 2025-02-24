import { Request } from '@simonbackx/simple-endpoints';
import { OrganizationFactory, Token, UserFactory } from '@stamhoofd/models';
import { Organization, PermissionLevel, Permissions } from '@stamhoofd/structures';

import { testServer } from '../../../../../tests/helpers/TestServer';
import { PatchOrganizationEndpoint } from './PatchOrganizationEndpoint';

describe('Endpoint.PatchOrganization', () => {
    // Test endpoint
    const endpoint = new PatchOrganizationEndpoint();

    test('Change the name of the organization', async () => {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({ organization, permissions: Permissions.create({ level: PermissionLevel.Full }) }).create();
        // const groups = await new GroupFactory({ organization }).createMultiple(2)
        const token = await Token.createToken(user);

        const r = Request.buildJson('PATCH', '/v2/organization', organization.getApiHost(), {
            id: organization.id,
            name: 'My crazy name',
        });
        r.headers.authorization = 'Bearer ' + token.accessToken;

        const response = await testServer.test(endpoint, r);
        expect(response.body).toBeDefined();

        if (!(response.body instanceof Organization)) {
            throw new Error('Expected Organization');
        }

        expect(response.body.id).toEqual(organization.id);
        expect(response.body.name).toEqual('My crazy name');
    });

    test("Can't change organization as a normal user", async () => {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({ organization }).create();
        const token = await Token.createToken(user);

        const r = Request.buildJson('PATCH', '/organization', organization.getApiHost(), {
            id: organization.id,
            name: 'My crazy name',
        });
        r.headers.authorization = 'Bearer ' + token.accessToken;

        await expect(testServer.test(endpoint, r)).rejects.toThrow(/permissions/i);
    });

    test("Can't change organization as a user with read access", async () => {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({ organization, permissions: Permissions.create({ level: PermissionLevel.Read }) }).create();
        const token = await Token.createToken(user);

        const r = Request.buildJson('PATCH', '/organization', organization.getApiHost(), {
            id: organization.id,
            name: 'My crazy name',
        });
        r.headers.authorization = 'Bearer ' + token.accessToken;

        await expect(testServer.test(endpoint, r)).rejects.toThrow(/permissions/i);
    });
});
