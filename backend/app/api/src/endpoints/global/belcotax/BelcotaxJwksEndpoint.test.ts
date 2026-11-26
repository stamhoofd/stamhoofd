import { Request } from '@node/endpoints';
import type * as jose from 'jose';
import { testServer } from '../../../../tests/helpers/TestServer.js';
import { BelcotaxJwksEndpoint } from './BelcotaxJwksEndpoint.js';

describe('Endpoint.BelcotaxJwks', () => {
    test('publishes the public key only, without version prefix', async () => {
        const response = await testServer.test(
            new BelcotaxJwksEndpoint(),
            new Request({ method: 'GET', url: '/belcotax/jwks', host: STAMHOOFD.domains.api }),
        );
        expect(response.headers['content-type']).toBe('application/json; charset=utf-8');

        const jwks = JSON.parse(response.body as string) as { keys: jose.JWK[] };
        expect(jwks.keys).toHaveLength(1);
        expect(jwks.keys[0]).toMatchObject({ kty: 'RSA', use: 'sig', alg: 'RS256' });
        expect(jwks.keys[0].kid).toBeTruthy();
        for (const parameter of ['d', 'p', 'q', 'dp', 'dq', 'qi']) {
            expect(jwks.keys[0]).not.toHaveProperty(parameter);
        }
    });
});
