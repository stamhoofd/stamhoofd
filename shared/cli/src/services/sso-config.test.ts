import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CliContext } from '../context/create-context.js';
import {
    belcotaxClientId,
    belcotaxRealm,
    belcotaxRepresentatives,
    belcotaxScope,
    buildBelcotaxKeycloakRealm,
    buildKeycloakRealm,
    readOrCreateBelcotaxClientKey,
    ssoClientId,
    ssoClientSecret,
    ssoUserEmail,
    writeKeycloakRealm,
} from './sso-config.js';

describe('buildKeycloakRealm', () => {
    it('creates a realm with the configured client and user', () => {
        const realm = buildKeycloakRealm('https://example.api.stamhoofd/openid/callback') as any;

        expect(realm.realm).toBe('stamhoofd');
        expect(realm.clients[0].clientId).toBe(ssoClientId);
        expect(realm.clients[0].secret).toBe(ssoClientSecret);
        expect(realm.clients[0].redirectUris).toEqual([
            'https://example.api.stamhoofd/openid/callback',
        ]);
        expect(realm.users[0].email).toBe(ssoUserEmail);
        expect(realm.users[0].credentials[0].temporary).toBe(false);
    });

    it('allows every given redirect uri', () => {
        const realm = buildKeycloakRealm([
            'https://playwright-api-0.stamhoofd/openid/callback',
            'https://playwright-api-1.stamhoofd/openid/callback',
        ]) as any;

        expect(realm.clients[0].redirectUris).toEqual([
            'https://playwright-api-0.stamhoofd/openid/callback',
            'https://playwright-api-1.stamhoofd/openid/callback',
        ]);
    });
});

describe('buildBelcotaxKeycloakRealm', () => {
    const publicJwk = { kty: 'RSA', n: 'abc', e: 'AQAB', kid: 'key-1', use: 'sig', alg: 'RS256' };

    it('stands in for FOD in a realm of its own', () => {
        const realm = buildBelcotaxKeycloakRealm({
            redirectUris: ['https://api.stamhoofd/oauth/belcotax'],
            publicJwk,
        }) as any;

        expect(realm.realm).toBe(belcotaxRealm);
        expect(realm).toMatchObject({
            revokeRefreshToken: true,
            refreshTokenMaxReuse: 0,
            accessTokenLifespan: 300,
            ssoSessionIdleTimeout: 7 * 24 * 60 * 60,
        });

        expect(realm.clients[0]).toMatchObject({
            clientId: belcotaxClientId,
            publicClient: false,
            clientAuthenticatorType: 'client-jwt',
            consentRequired: true,
            redirectUris: ['https://api.stamhoofd/oauth/belcotax'],
            defaultClientScopes: ['profile', belcotaxScope],
        });
        expect(realm.clients[0].attributes).toMatchObject({
            'pkce.code.challenge.method': 'S256',
            'use.jwks.url': 'false',
            'use.jwks.string': 'true',
            'access.token.lifespan': '300',
        });
        expect(JSON.parse(realm.clients[0].attributes['jwks.string'])).toEqual({
            keys: [publicJwk],
        });

        const scope = realm.clientScopes.find((s: any) => s.name === belcotaxScope);
        expect(scope.protocolMappers.map((m: any) => m.config['claim.name'])).toEqual([
            'customerEcb',
            'customerFirstname',
            'customerName',
        ]);
        expect(realm.users.map((u: any) => u.attributes.customerEcb[0])).toEqual(
            belcotaxRepresentatives.map((r) => r.companyNumber),
        );
    });
});

describe('readOrCreateBelcotaxClientKey', () => {
    it('generates the key once and only puts the public part in the realm', async () => {
        const generatedDir = await fs.mkdtemp(path.join(os.tmpdir(), 'stam-belcotax-'));
        const context = { generatedDir, instance: { name: 'stamhoofd' } } as CliContext;
        try {
            const first = await readOrCreateBelcotaxClientKey(context);
            const second = await readOrCreateBelcotaxClientKey(context);

            expect(second.privateJwk).toEqual(first.privateJwk);
            expect(first.privateJwk.d).toBeTruthy();
            expect(first.publicJwk).toEqual({
                kty: 'RSA',
                n: first.privateJwk.n,
                e: first.privateJwk.e,
                kid: first.privateJwk.kid,
                use: 'sig',
                alg: 'RS256',
            });

            const importDir = await writeKeycloakRealm(context, [], {
                belcotaxRedirectUris: ['https://api.stamhoofd/oauth/belcotax'],
            });
            const realm = JSON.parse(
                await fs.readFile(path.join(importDir, 'belcotax-realm.json'), 'utf8'),
            );
            const jwks = realm.clients[0].attributes['jwks.string'] as string;
            expect(JSON.parse(jwks)).toEqual({ keys: [first.publicJwk] });
        } finally {
            await fs.rm(generatedDir, { recursive: true, force: true });
        }
    });
});
