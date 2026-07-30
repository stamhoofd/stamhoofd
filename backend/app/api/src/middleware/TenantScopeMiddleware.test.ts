import type { DecodedRequest } from '@simonbackx/simple-endpoints';
import { Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { ROOT_TENANT_ID } from '@stamhoofd/models';
import { testServer } from '../../tests/helpers/TestServer.js';
import { TenantContext } from '../helpers/TenantContext.js';

type Params = Record<string, never>;

/**
 * Reports the tenant scope it was reached in, so a request can assert what the middleware set up.
 */
class TenantProbeEndpoint extends Endpoint<Params, undefined, undefined, string> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET' || request.url !== '/tenant-probe') {
            return [false];
        }
        return [true, {}];
    }

    async handle(_request: DecodedRequest<Params, undefined, undefined>) {
        return new Response(TenantContext.optional?.tenantId ?? 'no-tenant');
    }
}

describe('TenantScopeMiddleware', () => {
    test('a request runs in a tenant scope', async () => {
        const endpoint = new TenantProbeEndpoint();

        const response = await testServer.test(endpoint, Request.buildJson('GET', '/tenant-probe', 'localhost'));

        expect(response.body).toBe(ROOT_TENANT_ID);
    });

    test('the scope does not outlive the request', async () => {
        const endpoint = new TenantProbeEndpoint();

        await testServer.test(endpoint, Request.buildJson('GET', '/tenant-probe', 'localhost'));

        expect(TenantContext.optional).toBeNull();
    });
});
