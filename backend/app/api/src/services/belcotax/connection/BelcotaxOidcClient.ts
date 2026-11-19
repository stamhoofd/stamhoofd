import { SimpleError } from '@common/errors';
import { BelcotaxApiLogAction } from '@stamhoofd/models';
import { createHash, randomBytes } from 'node:crypto';
import * as jose from 'jose';

import { BelcotaxClientKeys } from './BelcotaxClientKeys.js';
import { BelcotaxConfig, BelcotaxScopes } from './BelcotaxConfig.js';
import type { BelcotaxLogContext } from './BelcotaxHttp.js';
import { BelcotaxHttp, describeError } from './BelcotaxHttp.js';

export type BelcotaxTokenSet = {
    accessToken: string;
    accessTokenExpiresAt: Date;
    refreshToken: string;
    refreshTokenValidUntil: Date;
    idToken: string | null;
};

export type BelcotaxIdTokenClaims = {
    companyNumber: string;
    representativeName: string;
};

export type BelcotaxAuthorization = {
    url: string;
    state: string;
    nonce: string;
    codeVerifier: string;
};

/**
 * FOD returns no lifetime for the refresh token (Keycloak does, as refresh_expires_in). It is
 * documented as 7 days (§3.1.3).
 */
export const BelcotaxRefreshTokenLifetime = 7 * 24 * 60 * 60 * 1000;

/**
 * Margin so we never present a refresh token that is about to expire as valid
 */
const refreshTokenMargin = 10 * 60 * 1000;

export class BelcotaxTokenError extends SimpleError {
    fodError: string | null = null;
}

function base64url(buffer: Buffer) {
    return buffer.toString('base64url');
}

export function createCodeChallenge(codeVerifier: string) {
    // base64url never pads, which FOD requires (§4.2.1)
    return base64url(createHash('sha256').update(codeVerifier).digest());
}

/**
 * OpenID Connect client for the authorization server of FOD Financiën, following "How to access
 * FPS Finances's APIs using the OIDC flow" (15/04/2026). Built on fetch and jose instead of
 * openid-client, because FOD requires a client assertion shape and an `ecb` claims parameter that
 * the library does not produce.
 */
export class BelcotaxOidcClient {
    private static remoteJwks = new Map<string, ReturnType<typeof jose.createRemoteJWKSet>>();

    static async createAuthorization(companyNumber: string): Promise<BelcotaxAuthorization> {
        const state = base64url(randomBytes(32));
        const nonce = base64url(randomBytes(32));
        const codeVerifier = base64url(randomBytes(48));

        const url = new URL((await BelcotaxConfig.getEndpoints()).authorization);
        url.searchParams.set('response_type', 'code');
        url.searchParams.set('client_id', BelcotaxConfig.clientId);
        url.searchParams.set('scope', BelcotaxScopes.join(' '));
        url.searchParams.set('redirect_uri', BelcotaxConfig.redirectUri);
        url.searchParams.set('state', state);
        url.searchParams.set('nonce', nonce);
        url.searchParams.set('code_challenge_method', 'S256');
        url.searchParams.set('code_challenge', createCodeChallenge(codeVerifier));
        // Not the claims request of OpenID Connect, but what FOD documents. Keycloak ignores it.
        url.searchParams.set('claims', JSON.stringify({ ecb: companyNumber }));

        return { url: url.href, state, nonce, codeVerifier };
    }

    static async exchangeCode(context: BelcotaxLogContext, code: string, codeVerifier: string) {
        return await this.tokenRequest(context, BelcotaxApiLogAction.TokenExchange, {
            grant_type: 'authorization_code',
            redirect_uri: BelcotaxConfig.redirectUri,
            code,
            code_verifier: codeVerifier,
        });
    }

    static async refresh(context: BelcotaxLogContext, refreshToken: string) {
        return await this.tokenRequest(context, BelcotaxApiLogAction.TokenRefresh, {
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
        });
    }

    private static async tokenRequest(
        context: BelcotaxLogContext,
        action: BelcotaxApiLogAction,
        parameters: Record<string, string>,
    ): Promise<BelcotaxTokenSet> {
        const endpoints = await BelcotaxConfig.getEndpoints();
        const body = new URLSearchParams({
            ...parameters,
            client_id: BelcotaxConfig.clientId,
            client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
            client_assertion: await BelcotaxClientKeys.createClientAssertion(endpoints.token),
        });

        const response = await BelcotaxHttp.request(context, action, {
            method: 'POST',
            url: endpoints.token,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
            body: body.toString(),
        });

        const json = (response.json ?? {}) as Record<string, unknown>;

        if (response.status !== 200) {
            const error = new BelcotaxTokenError({
                code: 'belcotax_token_error',
                message: 'FOD Financiën refused the token request: ' + describeError(json),
                human: $t('FOD Financiën weigerde de aanmelding. Probeer opnieuw te verbinden.'),
                statusCode: 400,
            });
            error.fodError = typeof json.error === 'string' ? json.error : null;
            throw error;
        }

        if (
            typeof json.access_token !== 'string' ||
            typeof json.refresh_token !== 'string' ||
            !json.access_token ||
            !json.refresh_token
        ) {
            throw new SimpleError({
                code: 'belcotax_invalid_token_response',
                message: 'FOD Financiën returned no access or refresh token',
                human: $t('FOD Financiën gaf een onverwacht antwoord. Probeer het later opnieuw.'),
                statusCode: 502,
            });
        }

        const expiresIn =
            typeof json.expires_in === 'number' && json.expires_in > 0 ? json.expires_in : 299;
        const refreshLifetime =
            typeof json.refresh_expires_in === 'number' && json.refresh_expires_in > 0
                ? json.refresh_expires_in * 1000
                : BelcotaxRefreshTokenLifetime;

        return {
            accessToken: json.access_token,
            // A little shorter than the server says, so they don't expire on the way
            accessTokenExpiresAt: new Date(Date.now() + Math.max(0, expiresIn - 30) * 1000),
            refreshToken: json.refresh_token,
            refreshTokenValidUntil: new Date(Date.now() + refreshLifetime - refreshTokenMargin),
            idToken: typeof json.id_token === 'string' ? json.id_token : null,
        };
    }

    /**
     * Keys of the authorization server, which sign its ID tokens (and access tokens of Keycloak)
     */
    static async getRemoteJwks() {
        const uri = (await BelcotaxConfig.getEndpoints()).jwks;
        let jwks = this.remoteJwks.get(uri);
        if (!jwks) {
            jwks = jose.createRemoteJWKSet(new URL(uri));
            this.remoteJwks.set(uri, jwks);
        }
        return jwks;
    }

    static clearJwksCache() {
        this.remoteJwks.clear();
    }

    /**
     * Validates the ID token (§4.3.3.3) and returns the company it was issued for.
     */
    static async verifyIdToken(
        idToken: string,
        options: { nonce?: string } = {},
    ): Promise<BelcotaxIdTokenClaims> {
        let payload: jose.JWTPayload;
        try {
            const result = await jose.jwtVerify(idToken, await this.getRemoteJwks(), {
                issuer: (await BelcotaxConfig.getEndpoints()).issuer,
                audience: BelcotaxConfig.clientId,
                algorithms: ['RS256'],
                clockTolerance: 60,
            });
            payload = result.payload;
        } catch (e) {
            throw new SimpleError({
                code: 'belcotax_invalid_id_token',
                message:
                    'Invalid ID token from FOD Financiën: ' +
                    (e instanceof Error ? e.message : String(e)),
                human: $t('FOD Financiën gaf een onverwacht antwoord. Probeer het later opnieuw.'),
                statusCode: 502,
            });
        }

        // FOD's example ID token has no nonce. When it is there, it has to match.
        if (options.nonce && payload.nonce !== undefined && payload.nonce !== options.nonce) {
            throw new SimpleError({
                code: 'belcotax_invalid_id_token',
                message: 'Nonce of the ID token does not match',
                human: $t('FOD Financiën gaf een onverwacht antwoord. Probeer het later opnieuw.'),
                statusCode: 400,
            });
        }

        const companyNumber =
            typeof payload.customerEcb === 'string' ? payload.customerEcb.replace(/\D+/g, '') : '';
        if (!companyNumber) {
            throw new SimpleError({
                code: 'belcotax_invalid_id_token',
                message: 'The ID token has no customerEcb',
                human: $t('FOD Financiën gaf een onverwacht antwoord. Probeer het later opnieuw.'),
                statusCode: 502,
            });
        }

        const representativeName = [payload.customerFirstname, payload.customerName]
            .filter((p): p is string => typeof p === 'string' && p.length > 0)
            .join(' ');

        return { companyNumber, representativeName };
    }
}
