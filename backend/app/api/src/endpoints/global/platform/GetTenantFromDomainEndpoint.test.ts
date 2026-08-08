import { Database } from '@simonbackx/simple-database';
import { Request } from '@simonbackx/simple-endpoints';
import { Platform, ROOT_TENANT_ID, Token, UserFactory } from '@stamhoofd/models';
import { PermissionLevel, Permissions, PlatformPrivateConfig, Version } from '@stamhoofd/structures';
import { STExpect } from '@stamhoofd/test-utils';

import { testServer } from '../../../../tests/helpers/TestServer.js';
import { GetTenantFromDomainEndpoint } from './GetTenantFromDomainEndpoint.js';
import { GetTenantFromUriEndpoint } from './GetTenantFromUriEndpoint.js';

describe('Endpoint.GetTenantFrom*', () => {
    const domainEndpoint = new GetTenantFromDomainEndpoint();
    const uriEndpoint = new GetTenantFromUriEndpoint();

    let registrationDomain: string;

    beforeEach(() => {
        registrationDomain = [...new Set(Object.values(STAMHOOFD.domains.registration ?? {}))][0];
        domainEndpoint.registrationDomains = [registrationDomain];
    });

    afterEach(async () => {
        await Database.delete('DELETE FROM platform WHERE id != ?', [ROOT_TENANT_ID]);
        await Platform.clearCache();
    });

    async function createTenant(options: { uri?: string; domain?: string }) {
        const root = await Platform.getForEditing();

        const tenant = new Platform();
        tenant.id = 'lookup-tenant';
        tenant.periodId = root.periodId;
        tenant.uri = options.uri ?? null;
        tenant.domain = options.domain ?? null;
        tenant.privateConfig = PlatformPrivateConfig.create({});
        await tenant.save();

        return tenant;
    }

    const byDomain = async (domain: string, token?: Token) => {
        const request = Request.buildJson('GET', `/v${Version}/tenant-from-domain?domain=${encodeURIComponent(domain)}`);
        if (token) {
            request.headers.authorization = 'Bearer ' + token.accessToken;
        }
        return await testServer.test(domainEndpoint, request);
    };

    const byUri = async (uri: string) => {
        return await testServer.test(
            uriEndpoint,
            Request.buildJson('GET', `/v${Version}/tenant-from-uri?uri=${encodeURIComponent(uri)}`),
        );
    };

    test('it resolves a tenant by its own domain', async () => {
        await createTenant({ domain: 'lookup.example.com' });

        const response = await byDomain('lookup.example.com');

        expect(response.body).toBe(await Platform.getStructForTenant('lookup-tenant'));
    });

    test('it resolves a tenant served from the registration domain', async () => {
        await createTenant({ uri: 'lookup-uri' });

        const response = await byDomain(`lookup-uri.${registrationDomain}`);

        expect(response.body).toBe(await Platform.getStructForTenant('lookup-tenant'));
    });

    test('an unknown host is a 404', async () => {
        await expect(byDomain('nobody.example.com')).rejects.toThrow(
            STExpect.simpleError({ code: 'unknown_domain' }),
        );
    });

    test('a deeper subdomain is not resolved', async () => {
        await createTenant({ uri: 'lookup-uri' });

        await expect(byDomain(`deeper.lookup-uri.${registrationDomain}`)).rejects.toThrow(
            STExpect.simpleError({ code: 'unknown_domain' }),
        );
    });

    test('it never answers with the private config', async () => {
        await createTenant({ domain: 'lookup.example.com' });

        // Even for a platform administrator: this endpoint is unauthenticated, so it must not become
        // a second way to read privateConfig
        const user = await new UserFactory({
            globalPermissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();
        const token = await Token.createToken(user);

        expect((await byDomain('lookup.example.com')).body.privateConfig).toBeNull();
        expect((await byDomain('lookup.example.com', token)).body.privateConfig).toBeNull();
    });

    test('it resolves a tenant by uri', async () => {
        await createTenant({ uri: 'lookup-uri' });

        const response = await byUri('lookup-uri');

        expect(response.body).toBe(await Platform.getStructForTenant('lookup-tenant'));
        expect(response.body.privateConfig).toBeNull();
    });

    test('an unknown uri is a 404', async () => {
        await expect(byUri('nobody')).rejects.toThrow(
            STExpect.simpleError({ code: 'unknown_uri' }),
        );
    });
});
