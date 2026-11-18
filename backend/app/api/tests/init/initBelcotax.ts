import type { Endpoint } from '@node/endpoints';
import { Request } from '@node/endpoints';
import type { Token } from '@stamhoofd/models';
import { OrganizationFactory } from '@stamhoofd/models';
import { Address, Company, Version } from '@stamhoofd/structures';
import type { BelcotaxConnectResponse } from '@stamhoofd/structures/belcotax/BelcotaxConnection.js';
import { BelcotaxFeatureFlag } from '@stamhoofd/structures/belcotax/BelcotaxConnection.js';
import { TestUtils } from '@stamhoofd/test-utils';
import { Country } from '@stamhoofd/types/Country';
import { BelcotaxCallbackEndpoint } from '../../src/endpoints/global/belcotax/BelcotaxCallbackEndpoint.js';
import { BelcotaxConnectEndpoint } from '../../src/endpoints/organization/dashboard/belcotax/BelcotaxConnectEndpoint.js';
import { BelcotaxFodDecision, BelcotaxFodMocker } from '../helpers/BelcotaxFodMocker.js';
import { testServer } from '../helpers/TestServer.js';
import { initAdmin } from './initAdmin.js';

export const belcotaxCompanyNumber = '0662348959';

export const belcotaxLocalIssuer = 'https://sso.belcotax.test/dex/realms/belcotax';

/**
 * FOD's acceptance environment by default; `local` is the Keycloak realm of `stam`
 */
export function initBelcotaxApi(
    environment: 'local' | 'acceptance' = 'acceptance',
): BelcotaxFodMocker {
    TestUtils.setEnvironment('BELCOTAX_ENVIRONMENT', environment);
    if (environment === 'acceptance') {
        TestUtils.setEnvironment('BELCOTAX_CLIENT_ID', 'stamhoofd-test');
        TestUtils.setEnvironment('BELCOTAX_ISSUER', undefined);
    } else {
        TestUtils.setEnvironment('BELCOTAX_CLIENT_ID', undefined);
        TestUtils.setEnvironment('BELCOTAX_ISSUER', belcotaxLocalIssuer);
    }
    const mocker = new BelcotaxFodMocker(environment);
    mocker.start();

    TestUtils.scheduleAfterThisTest(() => {
        mocker.stop();
    });

    return mocker;
}

export async function belcotaxRequest<T>(
    endpoint: Endpoint<any, any, any, any>,
    method: 'GET' | 'POST',
    path: string,
    host: string,
    token: Token,
    body?: unknown,
): Promise<{ body: T }> {
    const request = Request.buildJson(method, `/v${Version}${path}`, host, body);
    request.headers.authorization = 'Bearer ' + token.accessToken;
    return (await testServer.test(endpoint, request)) as unknown as { body: T };
}

/**
 * Organization with the feature flag, a company with a KBO number, one without and a full access admin
 */
export async function initBelcotaxOrganization({ featureFlag = true } = {}) {
    const address = Address.create({
        street: 'Kerkstraat',
        number: '1',
        postalCode: '9000',
        city: 'Gent',
        country: Country.Belgium,
    });
    const company = Company.create({
        name: 'Jeugdhuis De Kelder vzw',
        companyNumber: '0662.348.959',
        address,
    });
    const withoutNumber = Company.create({ name: 'Chiro Sint-Jan', address });

    const organization = await new OrganizationFactory({}).create();
    organization.meta.companies = [company, withoutNumber];
    if (featureFlag) {
        organization.privateMeta.featureFlags = [BelcotaxFeatureFlag];
    }
    await organization.save();

    const { admin, adminToken } = await initAdmin({ organization });
    return {
        organization,
        admin,
        token: adminToken,
        host: organization.getApiHost(),
        company,
        withoutNumber,
    };
}

export function belcotaxRedirectUri(path = '/beheerders/instellingen/belcotax') {
    return 'https://' + STAMHOOFD.domains.dashboard + path;
}

export async function startBelcotaxConnect(
    context: { host: string; token: Token },
    companyId: string,
) {
    const response = await belcotaxRequest<BelcotaxConnectResponse>(
        new BelcotaxConnectEndpoint(),
        'POST',
        '/organization/belcotax/connect',
        context.host,
        context.token,
        { companyId, redirectUri: belcotaxRedirectUri(), spaState: 'spa-state-1234567890' },
    );
    return response.body.authorizeUrl;
}

/**
 * Sends the browser back to our callback and returns where it is redirected to
 */
export async function callBelcotaxCallback(query: Record<string, string>) {
    const request = new Request({
        method: 'GET',
        url: '/oauth/belcotax',
        host: STAMHOOFD.domains.api,
        query,
    });
    const response = await testServer.test(new BelcotaxCallbackEndpoint(), request);
    expect(response.status).toBe(302);
    return new URL(response.headers['location'] as string);
}

/**
 * Connects the company through the whole flow, approved by a legal representative
 */
export async function connectBelcotax(
    mocker: BelcotaxFodMocker,
    context: { host: string; token: Token },
    companyId: string,
) {
    const authorizeUrl = await startBelcotaxConnect(context, companyId);
    const query = mocker.login(authorizeUrl, BelcotaxFodDecision.Approve);
    return await callBelcotaxCallback(query);
}
