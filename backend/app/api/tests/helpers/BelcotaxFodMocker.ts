import { createHash, randomBytes } from 'node:crypto';
import * as jose from 'jose';
import nock from 'nock';
import { BelcotaxClientKeys } from '../../src/services/belcotax/connection/BelcotaxClientKeys.js';
import {
    BelcotaxConfig,
    BelcotaxScopes,
} from '../../src/services/belcotax/connection/BelcotaxConfig.js';
import { BelcotaxOidcClient } from '../../src/services/belcotax/connection/BelcotaxOidcClient.js';
import { BelcotaxBulkApiMock } from '../../src/services/belcotax/local/BelcotaxBulkApiMock.js';
import { BelcotaxMockBulks } from '../../src/services/belcotax/local/BelcotaxBulkApiMockBulks.js';
import { resetNock } from './resetNock.js';

/**
 * What the legal representative does at the login of FOD
 */
export enum BelcotaxFodDecision {
    Approve = 'approve',
    /**
     * Not a legal representative of the company in the KBO: FOD refuses with invalid_scope. The
     * local Keycloak can't produce this, so only these tests cover it.
     */
    NotRepresentative = 'not-representative',
    Cancel = 'cancel',
    ServerError = 'server-error',
}

export type BelcotaxFodRequest = { method: string; path: string; body: Record<string, string> };

type Grant = { companyNumber: string; firstName: string; lastName: string };

type Code = Grant & {
    redirectUri: string;
    codeChallenge: string;
    nonce: string | null;
    expires: Date;
};

const random = () => randomBytes(24).toString('base64url');

/**
 * The authorization server of FOD Financiën and the Belcotax API as nock interceptors, following
 * "How to access FPS Finances's APIs using the OIDC flow" (15/04/2026): codes live 10 seconds,
 * access tokens 5 minutes, refresh tokens are single use for 7 days and the client assertion is
 * checked against our own JWKS. With `local`, it answers like the Keycloak realm of `stam`,
 * including the discovery document.
 *
 * Calls to the Belcotax API go to BelcotaxBulkApiMock, which accepts the access tokens issued here.
 */
export class BelcotaxFodMocker {
    requests: BelcotaxFodRequest[] = [];

    /**
     * Answers of the Belcotax API before normal handling, one per request
     */
    forcedApiResponses: { status: number; body: unknown }[] = [];

    representative = { firstName: 'An', lastName: 'Claes' };

    private codes = new Map<string, Code>();
    private refreshTokens = new Map<string, Grant & { expires: Date; used: boolean }>();
    private usedAssertions = new Set<string>();
    private signingKey: Promise<{ privateKey: jose.KeyLike; publicJwk: jose.JWK }> | null = null;

    constructor(readonly environment: 'local' | 'acceptance') {}

    private get paths() {
        return this.environment === 'local'
            ? {
                  token: '/protocol/openid-connect/token',
                  jwks: '/protocol/openid-connect/certs',
                  authorization: '/protocol/openid-connect/auth',
              }
            : { token: '/access_token', jwks: '/connect/jwk_uri', authorization: '/authorize' };
    }

    private get issuer() {
        return this.environment === 'local'
            ? STAMHOOFD.BELCOTAX_ISSUER!
            : 'https://fediamapi-a.minfin.be/sso/oauth2';
    }

    start() {
        BelcotaxConfig.clearCache();
        BelcotaxOidcClient.clearJwksCache();
        const issuer = new URL(this.issuer);
        const paths = this.paths;
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const mocker = this;

        const scope = nock(issuer.origin).persist();
        scope.post(issuer.pathname + paths.token).reply(async function (uri, body) {
            const form = Object.fromEntries(
                new URLSearchParams(typeof body === 'string' ? body : ''),
            );
            mocker.requests.push({ method: 'POST', path: uri, body: form });
            return await mocker.token(form);
        });
        scope.get(issuer.pathname + paths.jwks).reply(async function (uri) {
            mocker.requests.push({ method: 'GET', path: uri, body: {} });
            return [200, { keys: [(await mocker.getSigningKey()).publicJwk] }];
        });
        if (this.environment === 'local') {
            scope.get(issuer.pathname + '/.well-known/openid-configuration').reply(() => [
                200,
                {
                    issuer: this.issuer,
                    authorization_endpoint: this.issuer + paths.authorization,
                    token_endpoint: this.issuer + paths.token,
                    jwks_uri: this.issuer + paths.jwks,
                },
            ]);
        }

        const api = new URL(BelcotaxConfig.apiUrl);
        const apiScope = nock(api.origin).persist();
        for (const method of ['get', 'post'] as const) {
            apiScope[method]((path) => path.startsWith(api.pathname + '/')).reply(
                async function (uri, body) {
                    mocker.requests.push({ method: method.toUpperCase(), path: uri, body: {} });
                    const forced = mocker.forcedApiResponses.shift();
                    if (forced) {
                        return [forced.status, forced.body];
                    }
                    return await BelcotaxBulkApiMock.handle(
                        method.toUpperCase(),
                        uri.substring(api.pathname.length),
                        this.req.headers.authorization as string | undefined,
                        {
                            body: typeof body === 'string' ? body : JSON.stringify(body ?? ''),
                            contentType: this.req.headers['content-type'] as string | undefined,
                        },
                    );
                },
            );
        }
    }

    stop() {
        BelcotaxMockBulks.reset();
        BelcotaxConfig.clearCache();
        BelcotaxOidcClient.clearJwksCache();
        resetNock();
    }

    private async getSigningKey() {
        if (!this.signingKey) {
            this.signingKey = (async () => {
                const { privateKey, publicKey } = await jose.generateKeyPair('RS256');
                const publicJwk = await jose.exportJWK(publicKey);
                const kid = await jose.calculateJwkThumbprint(publicJwk);
                return { privateKey, publicJwk: { ...publicJwk, kid, use: 'sig', alg: 'RS256' } };
            })();
        }
        return await this.signingKey;
    }

    /**
     * What happens in the browser between our authorize URL and our callback: returns the query
     * string the server sends back to the redirect URI. `companyNumber` logs in for another company
     * than the one that was asked for.
     */
    login(
        authorizeUrl: string,
        decision: BelcotaxFodDecision,
        companyNumber?: string,
    ): Record<string, string> {
        const query = Object.fromEntries(new URL(authorizeUrl).searchParams);
        if (
            query.response_type !== 'code' ||
            query.client_id !== BelcotaxConfig.clientId ||
            query.redirect_uri !== BelcotaxConfig.redirectUri ||
            BelcotaxScopes.some((s) => !(query.scope ?? '').split(' ').includes(s)) ||
            query.code_challenge_method !== 'S256' ||
            !/^[\w-]{43}$/.test(query.code_challenge ?? '') ||
            !query.state
        ) {
            throw new Error('FOD would refuse this authentication request: ' + authorizeUrl);
        }
        const requested = (JSON.parse(query.claims ?? '{}') as { ecb?: string }).ecb ?? '';

        const result: Record<string, string> = { state: query.state };
        if (decision === BelcotaxFodDecision.NotRepresentative) {
            return {
                ...result,
                error: 'invalid_scope',
                error_description: `User has no rights to give consent for company ${requested}`,
            };
        }
        if (decision === BelcotaxFodDecision.Cancel) {
            return {
                ...result,
                error: 'access_denied',
                error_description: 'Resource Owner did not authorize the request',
            };
        }
        if (decision === BelcotaxFodDecision.ServerError) {
            return { ...result, error: 'server_error', error_description: 'Simulated error' };
        }

        const code = random();
        this.codes.set(code, {
            ...this.representative,
            companyNumber: companyNumber ?? requested,
            redirectUri: query.redirect_uri,
            codeChallenge: query.code_challenge,
            nonce: query.nonce ?? null,
            expires: new Date(Date.now() + 10_000),
        });
        return { ...result, code, iss: this.issuer, client_id: query.client_id };
    }

    expireRefreshTokens() {
        for (const token of this.refreshTokens.values()) {
            token.expires = new Date(0);
        }
    }

    private async token(form: Record<string, string>): Promise<[number, Record<string, unknown>]> {
        const clientError = await this.verifyClientAssertion(form);
        if (clientError) {
            return [401, { error: 'invalid_client', error_description: clientError }];
        }

        if (form.grant_type === 'authorization_code') {
            const code = this.codes.get(form.code);
            this.codes.delete(form.code);
            if (!code || code.expires < new Date() || form.redirect_uri !== code.redirectUri) {
                return [
                    400,
                    {
                        error: 'invalid_grant',
                        error_description:
                            'The provided access grant is invalid, expired, or revoked.',
                    },
                ];
            }
            if (
                createHash('sha256')
                    .update(form.code_verifier ?? '')
                    .digest('base64url') !== code.codeChallenge
            ) {
                return [
                    400,
                    { error: 'invalid_grant', error_description: 'PKCE verification failed' },
                ];
            }
            return [200, await this.issueTokens(code, code.nonce, true)];
        }

        if (form.grant_type === 'refresh_token') {
            const token = this.refreshTokens.get(form.refresh_token);
            if (!token || token.used || token.expires < new Date()) {
                return [400, { error: 'invalid_grant', error_description: 'grant is invalid' }];
            }
            token.used = true;
            return [200, await this.issueTokens(token, null, false)];
        }
        return [400, { error: 'unsupported_grant_type' }];
    }

    private async issueTokens(grant: Grant, nonce: string | null, withName: boolean) {
        const key = await this.getSigningKey();
        const sign = (claims: Record<string, unknown>) =>
            new jose.SignJWT({ ...claims, customerEcb: grant.companyNumber })
                .setProtectedHeader({ alg: 'RS256', typ: 'JWT', kid: key.publicJwk.kid })
                .setIssuer(this.issuer)
                .setSubject('00000000097')
                .setIssuedAt()
                .setExpirationTime('5m')
                .sign(key.privateKey);

        const refreshToken = random();
        this.refreshTokens.set(refreshToken, {
            companyNumber: grant.companyNumber,
            firstName: grant.firstName,
            lastName: grant.lastName,
            expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            used: false,
        });

        // FOD only includes the name in the first 3 minutes after the login (§4.3.3.2)
        const idClaims: Record<string, unknown> = {
            aud: BelcotaxConfig.clientId,
            user_type: 'externalapi',
        };
        if (withName) {
            idClaims.customerFirstname = grant.firstName;
            idClaims.customerName = grant.lastName;
        }
        if (nonce) {
            idClaims.nonce = nonce;
        }

        return {
            access_token: await sign({}),
            refresh_token: refreshToken,
            scope: ['ecb=' + grant.companyNumber, ...BelcotaxScopes].join(' '),
            id_token: await sign(idClaims),
            token_type: 'Bearer',
            expires_in: 299,
        };
    }

    /**
     * RFC 7523 client authentication as FOD checks it (§4.3.1)
     */
    private async verifyClientAssertion(form: Record<string, string>): Promise<string | null> {
        if (
            form.client_assertion_type !==
                'urn:ietf:params:oauth:client-assertion-type:jwt-bearer' ||
            !form.client_assertion
        ) {
            return 'Missing client assertion';
        }
        let header: jose.ProtectedHeaderParameters;
        try {
            header = jose.decodeProtectedHeader(form.client_assertion);
        } catch {
            return 'Malformed client assertion';
        }
        if (header.alg !== 'RS256' || header.typ !== 'JWT' || !header.kid) {
            return 'The client assertion needs alg RS256, typ JWT and a kid';
        }
        const jwk = (await BelcotaxClientKeys.getJwks()).keys.find((k) => k.kid === header.kid);
        if (!jwk || jwk.use !== 'sig') {
            return 'Unknown kid ' + header.kid;
        }
        try {
            const { payload } = await jose.jwtVerify(
                form.client_assertion,
                await jose.importJWK(jwk, 'RS256'),
                {
                    issuer: BelcotaxConfig.clientId,
                    subject: BelcotaxConfig.clientId,
                },
            );
            if (payload.aud !== this.issuer + this.paths.token) {
                return 'aud must be the token endpoint';
            }
            if (!payload.exp || payload.exp * 1000 > Date.now() + 30 * 60 * 1000) {
                return 'exp must be within 30 minutes';
            }
            if (!payload.jti || this.usedAssertions.has(payload.jti)) {
                return 'jti must be unique';
            }
            this.usedAssertions.add(payload.jti);
        } catch (e) {
            return e instanceof Error ? e.message : 'Invalid client assertion';
        }
        if (form.client_id !== undefined && form.client_id !== BelcotaxConfig.clientId) {
            return 'client_id does not match';
        }
        return null;
    }
}
