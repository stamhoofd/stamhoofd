import { Request } from '@simonbackx/simple-endpoints';
import { Organization } from '@stamhoofd/models';
import { Address, CreateOrganization, NewUser, Organization as OrganizationStruct, OrganizationMetaData, OrganizationPackages, STPackageStatus, STPackageType, UitpasClientCredentialsStatus, Version } from '@stamhoofd/structures';
import { Country } from '@stamhoofd/types/Country';

import { testServer } from '../../../../tests/helpers/TestServer.js';
import { CreateOrganizationEndpoint } from './CreateOrganizationEndpoint.js';

describe('Endpoint.CreateOrganization', () => {
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
        expect(response.body.token).not.toEqual([]);
    });

    test('Packages and the UiTPAS credentials status in the request are ignored', async () => {
        const r = Request.buildJson('POST', `/v${Version}/organizations`, 'todo-host.be', CreateOrganization.create({
            organization: OrganizationStruct.create({
                name: 'Organization with forged packages',
                uri: 'organization-with-forged-packages',
                address: Address.create({
                    street: 'My street',
                    number: '1',
                    postalCode: '9000',
                    city: 'Gent',
                    country: Country.Belgium,
                }),
                meta: OrganizationMetaData.create({
                    packages: OrganizationPackages.create({
                        packages: new Map([
                            [STPackageType.Members, STPackageStatus.create({ startDate: new Date(Date.now() - 1000) })],
                            [STPackageType.Webshops, STPackageStatus.create({ startDate: new Date(Date.now() - 1000) })],
                        ]),
                    }),
                    uitpasClientCredentialsStatus: UitpasClientCredentialsStatus.Ok,
                }),
            }),
            user: NewUser.create({
                email: 'forged-packages@stamhoofd.be',
                password: 'My user password',
            }),
        }).encode({ version: Version }));

        const response = await testServer.test(endpoint, r);
        expect(response.body.organization.meta.packages.packages.size).toBe(0);

        const organization = await Organization.getByID(response.body.organization.id);
        expect(organization!.meta.packages.packages.size).toBe(0);
        expect(organization!.meta.packages.isActive(STPackageType.Members)).toBe(false);
        expect(organization!.meta.uitpasClientCredentialsStatus).toBe(UitpasClientCredentialsStatus.NotConfigured);
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
