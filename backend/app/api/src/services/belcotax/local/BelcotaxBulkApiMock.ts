import * as jose from 'jose';

import { BelcotaxConfig } from '../connection/BelcotaxConfig.js';
import { BelcotaxOidcClient } from '../connection/BelcotaxOidcClient.js';

export type BelcotaxMockApiRequest = {
    method: string;
    /**
     * Relative to the base URL of the API, without query string
     */
    path: string;
    /**
     * Company the access token was issued for
     */
    companyNumber: string;
    match: RegExpExecArray;
    /**
     * Raw request body, e.g. the multipart form of a submission
     */
    body: string;
    contentType: string | undefined;
};

export type BelcotaxMockApiResponse = [status: number, body: unknown];

export type BelcotaxMockApiRoute = {
    method: string;
    path: RegExp;
    handle(
        request: BelcotaxMockApiRequest,
    ): BelcotaxMockApiResponse | Promise<BelcotaxMockApiResponse>;
};

/**
 * RFC 9457 problem in the Belgif format FOD uses (§5.4 of "How to access FPS Finances's APIs")
 */
export function belcotaxProblem(status: number, type: string, title: string, detail: string) {
    return {
        type: 'urn:problem-type:belgif:' + type,
        href: `https://www.belgif.be/specification/rest/api-guide/problems/${type}.html`,
        status,
        title,
        detail,
    };
}

/**
 * Stand-in for the Belcotax bulk API (schemas/openapi.yml) next to the
 * local Keycloak realm, which issues the access tokens. Only registered in development and tests.
 *
 * Only checks the access token for now: submitting, validations and feedback add their routes
 * (and the outcome they simulate) to `routes`.
 */
export class BelcotaxBulkApiMock {
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

        for (const route of this.routes) {
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
