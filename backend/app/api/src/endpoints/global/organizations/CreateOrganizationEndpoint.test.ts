import { Request } from '@simonbackx/simple-endpoints';
import { Address, Country, CreateOrganization, NewUser, Organization as OrganizationStruct, Version } from '@stamhoofd/structures';

import { testServer } from '../../../../tests/helpers/TestServer.js';
import { CreateOrganizationEndpoint } from './CreateOrganizationEndpoint.js';

describe.skip('Endpoint.CreateOrganization', () => {
    // Test endpoint
    const endpoint = new CreateOrganizationEndpoint();

    test('Can create a new organization', async () => {
        const r = Request.buildJson('POST', `/v${Version}/organizations`, 'todo-host.be', CreateOrganization.create({
            organization: OrganizationStruct.create({
                name: 'My endpoint test organization',
                uri: 'my-endpoint-test-organization',
                address: Address.create({
                    street: 'My street',
                    number: '1',
                    postalCode: '9000',
                    city: 'Gent',
                    country: Country.Belgium,
                }),

            }),
            user: NewUser.create({
                email: 'voorbeeld@stamhoofd.be',
                password: 'My user password',
            }),
        }).encode({ version: Version }));

        const response = await testServer.test(endpoint, r);
        expect(response.body.token).not.toBeEmpty();
    });

    test('Creating an organization with an in-use URI throws', async () => {
        const r = Request.buildJson('POST', `/v${Version}/organizations`, 'todo-host.be', CreateOrganization.create({
            organization: OrganizationStruct.create({
                name: 'My endpoint test organization',
                uri: 'my-endpoint-test-organization',
                address: Address.create({
                    street: 'My street',
                    number: '1',
                    postalCode: '9000',
                    city: 'Gent',
                    country: Country.Belgium,
                }),

            }),
            user: NewUser.create({
                email: 'voorbeeld@stamhoofd.be',
                password: 'My user password',
            }),
        }).encode({ version: Version }));

        await expect(testServer.test(endpoint, r)).rejects.toThrow(/name/);
    });
});
