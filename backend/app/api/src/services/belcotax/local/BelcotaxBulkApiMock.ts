import * as jose from 'jose';

import { BelcotaxConfig } from '../connection/BelcotaxConfig.js';
import { BelcotaxOidcClient } from '../connection/BelcotaxOidcClient.js';
import { BelcotaxMockBulks } from './BelcotaxBulkApiMockBulks.js';
import type { BelcotaxMockApiResponse, BelcotaxMockApiRoute } from './BelcotaxMockApi.js';
import { belcotaxProblem } from './BelcotaxMockApi.js';

export type {
    BelcotaxMockApiRequest,
    BelcotaxMockApiResponse,
    BelcotaxMockApiRoute,
} from './BelcotaxMockApi.js';
export { belcotaxProblem } from './BelcotaxMockApi.js';

/**
 * Stand-in for the Belcotax bulk API (schemas/openapi.yml) next to the
 * local Keycloak realm, which issues the access tokens. Only registered in development and tests.
 *
 * Submitting, validations and feedback are in BelcotaxMockBulks, which also chooses the outcome.
 */
export class BelcotaxBulkApiMock {
    /**
     * Extra routes for tests, before the ones of BelcotaxMockBulks
     */
    static routes: BelcotaxMockApiRoute[] = [];

    static async handle(
        method: string,
        path: string,
        authorization: string | undefined,
        body: { body: string; contentType: string | undefined } = {
            body: '',
            contentType: undefined,
        },
    ): Promise<BelcotaxMockApiResponse> {
        if (method === 'GET' && path === '/health') {
            return [200, { status: 'UP' }];
        }

        const match = /^Bearer (.+)$/.exec(authorization ?? '');
        if (!match) {
            return [
                401,
                belcotaxProblem(
                    401,
                    'noAccessToken',
                    'No Access Token',
                    'No Bearer access token found in Authorization HTTP header',
                ),
            ];
        }

        const companyNumber = await this.verifyAccessToken(match[1]);
        if (!companyNumber) {
            return [
                401,
                belcotaxProblem(
                    401,
                    'invalidAccessToken',
                    'Invalid Access Token',
                    'The Bearer access token found in the Authorization HTTP header is invalid',
                ),
            ];
        }

        for (const route of [...this.routes, ...BelcotaxMockBulks.routes]) {
            const routeMatch = route.method === method ? route.path.exec(path) : null;
            if (routeMatch) {
                return await route.handle({
                    method,
                    path,
                    companyNumber,
                    match: routeMatch,
                    ...body,
                });
            }
        }
        return [
            404,
            belcotaxProblem(
                404,
                'resourceNotFound',
                'Resource Not Found',
                `No resource ${path} found`,
            ),
        ];
    }

    /**
     * Keycloak's access tokens are JWTs with the company in `customerEcb`
     */
    private static async verifyAccessToken(token: string): Promise<string | null> {
        try {
            const { payload } = await jose.jwtVerify(
                token,
                await BelcotaxOidcClient.getRemoteJwks(),
                {
                    issuer: (await BelcotaxConfig.getEndpoints()).issuer,
                    algorithms: ['RS256'],
                },
            );
            return typeof payload.customerEcb === 'string' ? payload.customerEcb : null;
        } catch {
            return null;
        }
    }
}
