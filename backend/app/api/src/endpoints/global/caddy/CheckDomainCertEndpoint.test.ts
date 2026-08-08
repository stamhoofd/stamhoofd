import { Database } from '@simonbackx/simple-database';
import { Request } from '@simonbackx/simple-endpoints';
import { OrganizationFactory, Platform, ROOT_TENANT_ID } from '@stamhoofd/models';
import { Version } from '@stamhoofd/structures';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';

import { testServer } from '../../../../tests/helpers/TestServer.js';
import { CheckDomainCertEndpoint } from './CheckDomainCertEndpoint.js';

describe('Endpoint.CheckDomainCertEndpoint', () => {
    const endpoint = new CheckDomainCertEndpoint();

    const ask = async (domain: string) => {
        return await testServer.test(
            endpoint,
            Request.buildJson('GET', `/v${Version}/check-domain-cert?domain=${encodeURIComponent(domain)}`),
        );
    };

    let registrationDomain: string;

    beforeEach(async () => {
        registrationDomain = [...new Set(Object.values(STAMHOOFD.domains.registration ?? {}))][0];
        endpoint.registrationDomains = [registrationDomain];
    });

    afterEach(async () => {
        await Database.delete('DELETE FROM platform WHERE id != ?', [ROOT_TENANT_ID]);
        await Platform.clearCache();
    });

    async function createTenant(options: { uri?: string; domain?: string }) {
        const root = await Platform.getForEditing();

        const tenant = new Platform();
        tenant.id = 'cert-tenant';
        tenant.periodId = root.periodId;
        tenant.uri = options.uri ?? null;
        tenant.domain = options.domain ?? null;
        await tenant.save();

        return tenant;
    }

    test('an unknown domain is refused', async () => {
        await expect(ask('nope.example.com')).rejects.toThrow(
            STExpect.simpleError({ code: 'unknown_domain' }),
        );
    });

    test('an organization uri is still accepted', async () => {
        const organization = await new OrganizationFactory({}).create();

        await expect(ask(`${organization.uri}.${registrationDomain}`)).resolves.toBeDefined();
    });

    test('a tenant uri is accepted', async () => {
        await createTenant({ uri: 'cert-tenant-uri' });

        await expect(ask(`cert-tenant-uri.${registrationDomain}`)).resolves.toBeDefined();
    });

    test('an unknown uri is still refused', async () => {
        await createTenant({ uri: 'cert-tenant-uri' });

        await expect(ask(`something-else.${registrationDomain}`)).rejects.toThrow(
            STExpect.simpleError({ code: 'unknown_domain' }),
        );
    });

    test('a tenant domain is accepted', async () => {
        await createTenant({ domain: 'tenant.example.com' });

        await expect(ask('tenant.example.com')).resolves.toBeDefined();
    });

    test('a tenant without a uri or domain matches nothing', async () => {
        await createTenant({ uri: undefined, domain: undefined });

        await expect(ask(`.${registrationDomain}`)).rejects.toThrow();
        await expect(ask(`unclaimed.${registrationDomain}`)).rejects.toThrow(
            STExpect.simpleError({ code: 'unknown_domain' }),
        );
    });
});
