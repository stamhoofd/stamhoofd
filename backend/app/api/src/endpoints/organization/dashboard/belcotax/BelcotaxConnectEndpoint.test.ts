import { BelcotaxApiLog, BelcotaxApiLogAction, BelcotaxConnection } from '@stamhoofd/models';
import { Permissions } from '@stamhoofd/structures';
import type { BelcotaxConnection as BelcotaxConnectionStruct } from '@stamhoofd/structures/belcotax/BelcotaxConnection.js';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';
import { PermissionLevel } from '@stamhoofd/types/PermissionLevel';
import type { BelcotaxFodMocker } from '../../../../../tests/helpers/BelcotaxFodMocker.js';
import { BelcotaxFodDecision } from '../../../../../tests/helpers/BelcotaxFodMocker.js';
import { initAdmin } from '../../../../../tests/init/initAdmin.js';
import {
    belcotaxCompanyNumber,
    belcotaxLocalIssuer,
    belcotaxRedirectUri,
    belcotaxRequest,
    callBelcotaxCallback,
    connectBelcotax,
    initBelcotaxApi,
    initBelcotaxOrganization,
    startBelcotaxConnect,
} from '../../../../../tests/init/initBelcotax.js';
import { BelcotaxConfig } from '../../../../services/belcotax/connection/BelcotaxConfig.js';
import { BelcotaxConnectEndpoint } from './BelcotaxConnectEndpoint.js';
import { GetBelcotaxConnectionsEndpoint } from './GetBelcotaxConnectionsEndpoint.js';

describe('Endpoint.BelcotaxConnect', () => {
    let fod: BelcotaxFodMocker;

    beforeEach(() => {
        TestUtils.setEnvironment('userMode', 'organization');
        fod = initBelcotaxApi();
    });

    // createdAt has no milliseconds, so the order of one login is reconstructed from the actions
    const order = [
        BelcotaxApiLogAction.Authorize,
        BelcotaxApiLogAction.TokenExchange,
        BelcotaxApiLogAction.TokenRefresh,
        BelcotaxApiLogAction.ApiCall,
        BelcotaxApiLogAction.Callback,
    ];

    async function getLogs(organizationId: string) {
        const logs = await BelcotaxApiLog.select().where('organizationId', organizationId).fetch();
        return logs.sort((a, b) => order.indexOf(a.action) - order.indexOf(b.action));
    }

    test('returns the authorize URL of FOD with PKCE and the KBO number', async () => {
        const context = await initBelcotaxOrganization();
        const url = new URL(await startBelcotaxConnect(context, context.company.id));

        expect(url.origin + url.pathname).toBe(
            'https://fediamapi-a.minfin.be/sso/oauth2/authorize',
        );
        expect(Object.fromEntries(url.searchParams)).toMatchObject({
            response_type: 'code',
            client_id: BelcotaxConfig.clientId,
            scope: 'openid profile belcotax-manage-api',
            redirect_uri: 'https://' + STAMHOOFD.domains.api + '/oauth/belcotax',
            code_challenge_method: 'S256',
            claims: JSON.stringify({ ecb: belcotaxCompanyNumber }),
        });
        // Unpadded SHA-256 (§4.2.1)
        expect(url.searchParams.get('code_challenge')).toMatch(/^[\w-]{43}$/);
        expect(url.searchParams.get('state')!.length).toBeGreaterThan(20);
        expect(url.searchParams.get('nonce')!.length).toBeGreaterThan(20);

        const logs = await getLogs(context.organization.id);
        expect(logs).toMatchObject([
            {
                action: BelcotaxApiLogAction.Authorize,
                companyNumber: belcotaxCompanyNumber,
                userId: context.admin.id,
                success: true,
            },
        ]);
    });

    test('a legal representative connects the company', async () => {
        const context = await initBelcotaxOrganization();
        const location = await connectBelcotax(fod, context, context.company.id);

        expect(location.origin + location.pathname).toBe(belcotaxRedirectUri());
        expect(location.searchParams.get('belcotax_result')).toBe('connected');
        expect(location.searchParams.get('belcotax_state')).toBe('spa-state-1234567890');

        const connection = await BelcotaxConnection.getFor(
            context.organization.id,
            belcotaxCompanyNumber,
        );
        expect(connection).toMatchObject({
            representativeName: 'An Claes',
            userId: context.admin.id,
        });
        expect(connection!.refreshToken).toBeTruthy();
        expect(connection!.validUntil.getTime()).toBeGreaterThan(
            Date.now() + 6.9 * 24 * 60 * 60 * 1000,
        );

        // The client assertion was sent and accepted by the token endpoint
        const tokenRequest = fod.requests.find((r) => r.path.endsWith('/access_token'))!;
        expect(tokenRequest.body).toMatchObject({
            grant_type: 'authorization_code',
            client_id: BelcotaxConfig.clientId,
            client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
            redirect_uri: BelcotaxConfig.redirectUri,
        });

        const response = await belcotaxRequest<BelcotaxConnectionStruct[]>(
            new GetBelcotaxConnectionsEndpoint(),
            'GET',
            '/organization/belcotax/connections',
            context.host,
            context.token,
        );
        expect(response.body).toHaveLength(1);
        expect(response.body[0]).toMatchObject({
            companyNumber: belcotaxCompanyNumber,
            representativeName: 'An Claes',
        });
        expect(JSON.stringify(response.body)).not.toContain(connection!.refreshToken!);

        const logs = await getLogs(context.organization.id);
        expect(logs.map((l) => [l.action, l.success])).toEqual([
            [BelcotaxApiLogAction.Authorize, true],
            [BelcotaxApiLogAction.TokenExchange, true],
            [BelcotaxApiLogAction.Callback, true],
        ]);
        expect(logs[2]).toMatchObject({
            representativeName: 'An Claes',
            connectionId: connection!.id,
        });
        expect(JSON.stringify(logs)).not.toContain(connection!.refreshToken!);
    });

    test('FOD refuses someone who is not a legal representative and nothing changes', async () => {
        const context = await initBelcotaxOrganization();
        const query = fod.login(
            await startBelcotaxConnect(context, context.company.id),
            BelcotaxFodDecision.NotRepresentative,
        );
        const location = await callBelcotaxCallback(query);

        expect(location.searchParams.get('belcotax_result')).toBe('error');
        expect(location.searchParams.get('belcotax_error')).toContain(
            'geen wettelijk vertegenwoordiger',
        );
        expect(location.searchParams.get('belcotax_error')).toContain('0662.348.959');
        expect(
            await BelcotaxConnection.getFor(context.organization.id, belcotaxCompanyNumber),
        ).toBeNull();
        // No token request without a code
        expect(fod.requests.filter((r) => r.path.endsWith('/access_token'))).toHaveLength(0);

        const logs = await getLogs(context.organization.id);
        expect(logs.at(-1)).toMatchObject({
            action: BelcotaxApiLogAction.Callback,
            success: false,
        });
        expect(logs.at(-1)!.error).toContain('no rights');
    });

    test('a refused login keeps the existing connection', async () => {
        const context = await initBelcotaxOrganization();
        await connectBelcotax(fod, context, context.company.id);
        const before = await BelcotaxConnection.getFor(
            context.organization.id,
            belcotaxCompanyNumber,
        );

        const query = fod.login(
            await startBelcotaxConnect(context, context.company.id),
            BelcotaxFodDecision.Cancel,
        );
        const location = await callBelcotaxCallback(query);
        expect(location.searchParams.get('belcotax_error')).toContain('geen toestemming');

        const after = await BelcotaxConnection.getFor(
            context.organization.id,
            belcotaxCompanyNumber,
        );
        expect(after!.refreshToken).toBe(before!.refreshToken);
    });

    test('a login for another company is refused', async () => {
        const context = await initBelcotaxOrganization();
        const query = fod.login(
            await startBelcotaxConnect(context, context.company.id),
            BelcotaxFodDecision.Approve,
            '0999999031',
        );
        const location = await callBelcotaxCallback(query);

        expect(location.searchParams.get('belcotax_result')).toBe('error');
        expect(location.searchParams.get('belcotax_error')).toContain('0999.999.031');
        expect(
            await BelcotaxConnection.select()
                .where('organizationId', context.organization.id)
                .count(),
        ).toBe(0);
    });

    test('a callback can only be used once', async () => {
        const context = await initBelcotaxOrganization();
        const query = fod.login(
            await startBelcotaxConnect(context, context.company.id),
            BelcotaxFodDecision.Approve,
        );
        await callBelcotaxCallback(query);

        const replay = await callBelcotaxCallback(query);
        expect(replay.searchParams.get('belcotax_result')).toBe('error');
        expect(replay.origin).toBe('https://' + STAMHOOFD.domains.dashboard);
    });

    test('a callback from another issuer is refused', async () => {
        const context = await initBelcotaxOrganization();
        const query = fod.login(
            await startBelcotaxConnect(context, context.company.id),
            BelcotaxFodDecision.Approve,
        );
        const location = await callBelcotaxCallback({
            ...query,
            iss: 'https://evil.example/sso/oauth2',
        });

        expect(location.searchParams.get('belcotax_result')).toBe('error');
        expect(
            await BelcotaxConnection.select()
                .where('organizationId', context.organization.id)
                .count(),
        ).toBe(0);
    });

    test('the local environment finds the endpoints of Keycloak in its discovery document', async () => {
        fod.stop();
        fod = initBelcotaxApi('local');
        const context = await initBelcotaxOrganization();
        const authorizeUrl = await startBelcotaxConnect(context, context.company.id);
        expect(
            authorizeUrl.startsWith(belcotaxLocalIssuer + '/protocol/openid-connect/auth?'),
        ).toBe(true);
        expect(new URL(authorizeUrl).searchParams.get('client_id')).toBe('stamhoofd-belcotax');

        const location = await callBelcotaxCallback(
            fod.login(authorizeUrl, BelcotaxFodDecision.Approve),
        );
        expect(location.searchParams.get('belcotax_result')).toBe('connected');
        expect(fod.requests.map((r) => r.path)).toContain(
            '/dex/realms/belcotax/protocol/openid-connect/token',
        );
    });

    test('only a company with a KBO number can connect', async () => {
        const context = await initBelcotaxOrganization();
        await expect(startBelcotaxConnect(context, context.withoutNumber.id)).rejects.toThrow(
            STExpect.simpleError({ code: 'belcotax_missing_company_number' }),
        );
    });

    test('only returns to the dashboard', async () => {
        const context = await initBelcotaxOrganization();
        await expect(
            belcotaxRequest(
                new BelcotaxConnectEndpoint(),
                'POST',
                '/organization/belcotax/connect',
                context.host,
                context.token,
                {
                    companyId: context.company.id,
                    redirectUri: 'https://evil.example/',
                    spaState: 'spa-state-1234567890',
                },
            ),
        ).rejects.toThrow(STExpect.simpleError({ code: 'invalid_redirect_uri' }));
    });

    test('requires full access and the feature flag', async () => {
        const context = await initBelcotaxOrganization();
        const { adminToken: writeToken } = await initAdmin({
            organization: context.organization,
            permissions: Permissions.create({ level: PermissionLevel.Write }),
        });
        await expect(
            startBelcotaxConnect({ host: context.host, token: writeToken }, context.company.id),
        ).rejects.toThrow(STExpect.simpleError({ code: 'permission_denied' }));
        await expect(
            belcotaxRequest(
                new GetBelcotaxConnectionsEndpoint(),
                'GET',
                '/organization/belcotax/connections',
                context.host,
                writeToken,
            ),
        ).rejects.toThrow(STExpect.simpleError({ code: 'permission_denied' }));

        const other = await initBelcotaxOrganization({ featureFlag: false });
        await expect(startBelcotaxConnect(other, other.company.id)).rejects.toThrow(
            STExpect.simpleError({ code: 'not_available' }),
        );
        await expect(
            belcotaxRequest(
                new GetBelcotaxConnectionsEndpoint(),
                'GET',
                '/organization/belcotax/connections',
                other.host,
                other.token,
            ),
        ).rejects.toThrow(STExpect.simpleError({ code: 'not_available' }));
    });

    test('is unavailable when no environment is configured', async () => {
        TestUtils.setEnvironment('BELCOTAX_ENVIRONMENT', undefined);
        const context = await initBelcotaxOrganization();
        await expect(startBelcotaxConnect(context, context.company.id)).rejects.toThrow(
            STExpect.simpleError({ code: 'belcotax_not_configured' }),
        );
    });
});
