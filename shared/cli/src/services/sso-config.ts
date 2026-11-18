import { createHash, generateKeyPairSync, type JsonWebKey } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { buildDomains } from '../config/build-config.js';
import type { CliContext } from '../context/create-context.js';

export const ssoRealm = 'stamhoofd';
export const ssoClientId = 'stamhoofd-local';
export const ssoClientSecret = 'stamhoofd-local-secret';
export const ssoUserEmail = 'sso@example.com';
// eslint-disable-next-line secure-coding/no-hardcoded-credentials -- Deliberate test user in the CLI-managed local SSO realm.
export const ssoUserPassword = 'password';
export const ssoUserName = 'Local SSO User';
export const ssoAdminUser = 'admin';
// eslint-disable-next-line secure-coding/no-hardcoded-credentials -- Deliberate admin account in the CLI-managed local SSO realm.
export const ssoAdminPassword = 'admin';

/**
 * Second realm of the same server that stands in for the authorization server of FOD Financiën
 */
export const belcotaxRealm = 'belcotax';
export const belcotaxClientId = 'stamhoofd-belcotax';
export const belcotaxScope = 'belcotax-manage-api';

/**
 * Test users that are the legal representative of one company each, with the password of the SSO
 * test user. The numbers are test enterprises of FOD's acceptance environment (§6.2 of "How to
 * access FPS Finances's APIs using the OIDC flow"). Logging in as one while connecting another
 * company simulates a login for the wrong company. Keycloak remembers a consent, so the e2e tests
 * keep the third one for refusing it. Keycloak fails a token request when two logins of the same
 * user give consent at the same time, so the fourth one is kept for one e2e spec of its own.
 */
export const belcotaxRepresentatives = [
    {
        email: 'vertegenwoordiger@example.com',
        firstName: 'An',
        lastName: 'Claes',
        companyNumber: '0662348959',
    },
    {
        email: 'vertegenwoordiger2@example.com',
        firstName: 'Jan',
        lastName: 'Peeters',
        companyNumber: '0663895516',
    },
    {
        email: 'vertegenwoordiger3@example.com',
        firstName: 'Lies',
        lastName: 'Maes',
        companyNumber: '0999998932',
    },
    {
        email: 'vertegenwoordiger4@example.com',
        firstName: 'Tom',
        lastName: 'Wouters',
        companyNumber: '0999999031',
    },
] as const;

export function buildSsoConfigOutput(
    domains: ReturnType<typeof buildDomains>,
    redirectUri?: string,
): string {
    const issuer = `https://${domains.sso}/dex/realms/${ssoRealm}`;
    const resolvedRedirectUri =
        redirectUri ?? `https://<organization-id>.${domains.api}/openid/callback`;
    const representatives = belcotaxRepresentatives
        .map((r) => `  ${r.email.padEnd(32)} ${r.firstName} ${r.lastName}, KBO ${r.companyNumber}`)
        .join('\n');

    return `Local SSO settings:

  Issuer:        ${issuer}
  Discovery:     ${issuer}/.well-known/openid-configuration
  Client ID:     ${ssoClientId}
  Client secret: ${ssoClientSecret}
  Redirect URI:  ${resolvedRedirectUri}

Test user:

  Email:         ${ssoUserEmail}
  Password:      ${ssoUserPassword}
  Name:          ${ssoUserName}

Belcotax (stands in for FOD Financiën, BELCOTAX_ENVIRONMENT=local):

  Issuer:        https://${domains.sso}/dex/realms/${belcotaxRealm}
  Client ID:     ${belcotaxClientId}
  Redirect URI:  https://${domains.api}/oauth/belcotax
  Legal representatives (password ${ssoUserPassword}):
${representatives}

Admin console:

  URL:           https://${domains.sso}/dex/admin
  Username:      ${ssoAdminUser}
  Password:      ${ssoAdminPassword}

Commands:

  stam sso start "${resolvedRedirectUri}"`;
}

export function buildKeycloakRealm(redirectUris: string | string[]): Record<string, unknown> {
    const [firstName, lastName] = splitName(ssoUserName);

    return {
        realm: ssoRealm,
        enabled: true,
        displayName: 'Stamhoofd Local',
        sslRequired: 'external',
        registrationAllowed: false,
        loginWithEmailAllowed: true,
        duplicateEmailsAllowed: false,
        resetPasswordAllowed: false,
        editUsernameAllowed: false,
        bruteForceProtected: false,
        defaultSignatureAlgorithm: 'RS256',
        clients: [
            {
                clientId: ssoClientId,
                name: 'Stamhoofd Local',
                enabled: true,
                protocol: 'openid-connect',
                secret: ssoClientSecret,
                publicClient: false,
                clientAuthenticatorType: 'client-secret',
                standardFlowEnabled: true,
                implicitFlowEnabled: false,
                directAccessGrantsEnabled: false,
                serviceAccountsEnabled: false,
                redirectUris: Array.isArray(redirectUris) ? redirectUris : [redirectUris],
                webOrigins: ['+'],
                defaultClientScopes: ['web-origins', 'acr', 'profile', 'roles', 'email'],
                optionalClientScopes: ['address', 'phone', 'offline_access', 'microprofile-jwt'],
                attributes: {
                    'pkce.code.challenge.method': 'S256',
                    'post.logout.redirect.uris': '+',
                },
            },
        ],
        users: [
            {
                username: ssoUserEmail,
                email: ssoUserEmail,
                firstName,
                lastName,
                enabled: true,
                emailVerified: true,
                realmRoles: ['offline_access'],
                credentials: [
                    {
                        type: 'password',
                        value: ssoUserPassword,
                        temporary: false,
                    },
                ],
            },
        ],
    };
}

export type KeycloakBelcotaxOptions = {
    redirectUris: string[];
    /**
     * Public part of the key the backend signs its client assertion with
     */
    publicJwk: JsonWebKey;
};

const sevenDays = 7 * 24 * 60 * 60;

function claimMapper(mapper: string, attribute: string, claimName: string) {
    return {
        name: claimName,
        protocol: 'openid-connect',
        protocolMapper: mapper,
        consentRequired: false,
        config: {
            'user.attribute': attribute,
            'claim.name': claimName,
            'jsonType.label': 'String',
            'id.token.claim': 'true',
            'access.token.claim': 'true',
            'userinfo.token.claim': 'true',
            'introspection.token.claim': 'true',
        },
    };
}

/**
 * Stand-in for the authorization server of FOD Financiën. A realm of its own, so its token rules
 * don't apply to the SSO realm. Follows "How to access FPS Finances's APIs using the OIDC flow"
 * (15/04/2026): access tokens of 5 minutes, refresh tokens that are single use and valid for 7
 * days, PKCE, consent and a signed JWT as client authentication.
 */
export function buildBelcotaxKeycloakRealm(
    belcotax: KeycloakBelcotaxOptions,
): Record<string, unknown> {
    return {
        realm: belcotaxRealm,
        enabled: true,
        displayName: 'FOD Financiën (lokaal)',
        sslRequired: 'external',
        registrationAllowed: false,
        loginWithEmailAllowed: true,
        resetPasswordAllowed: false,
        bruteForceProtected: false,
        defaultSignatureAlgorithm: 'RS256',
        accessTokenLifespan: 300,
        revokeRefreshToken: true,
        refreshTokenMaxReuse: 0,
        // A refresh token lives as long as the session is idle: each refresh extends it
        ssoSessionIdleTimeout: sevenDays,
        ssoSessionMaxLifespan: 52 * sevenDays,
        // A realm import that lists client scopes gets none of the built-in ones
        clientScopes: [
            {
                name: 'profile',
                protocol: 'openid-connect',
                attributes: {
                    'include.in.token.scope': 'true',
                    'display.on.consent.screen': 'false',
                },
            },
            {
                name: belcotaxScope,
                description: 'Belcotax-on-web',
                protocol: 'openid-connect',
                attributes: {
                    'include.in.token.scope': 'true',
                    'display.on.consent.screen': 'true',
                    'consent.screen.text': 'Fiscale fiches indienen bij Belcotax-on-web',
                },
                protocolMappers: [
                    claimMapper('oidc-usermodel-attribute-mapper', 'customerEcb', 'customerEcb'),
                    claimMapper('oidc-usermodel-property-mapper', 'firstName', 'customerFirstname'),
                    claimMapper('oidc-usermodel-property-mapper', 'lastName', 'customerName'),
                ],
            },
        ],
        clients: [
            {
                clientId: belcotaxClientId,
                name: 'Stamhoofd',
                enabled: true,
                protocol: 'openid-connect',
                publicClient: false,
                clientAuthenticatorType: 'client-jwt',
                consentRequired: true,
                standardFlowEnabled: true,
                implicitFlowEnabled: false,
                directAccessGrantsEnabled: false,
                serviceAccountsEnabled: false,
                redirectUris: belcotax.redirectUris,
                defaultClientScopes: ['profile', belcotaxScope],
                optionalClientScopes: [],
                attributes: {
                    'pkce.code.challenge.method': 'S256',
                    'token.endpoint.auth.signing.alg': 'RS256',
                    'use.jwks.url': 'false',
                    'use.jwks.string': 'true',
                    'jwks.string': JSON.stringify({ keys: [belcotax.publicJwk] }),
                    'access.token.lifespan': '300',
                    'use.refresh.tokens': 'true',
                },
            },
        ],
        users: belcotaxRepresentatives.map((representative) => ({
            username: representative.email,
            email: representative.email,
            firstName: representative.firstName,
            lastName: representative.lastName,
            enabled: true,
            emailVerified: true,
            attributes: { customerEcb: [representative.companyNumber] },
            credentials: [{ type: 'password', value: ssoUserPassword, temporary: false }],
        })),
    };
}

/**
 * The RSA key pair of the local Belcotax client. Generated once per instance next to the other
 * generated files, so the realm and the backend always use the same key. Development only.
 */
export async function readOrCreateBelcotaxClientKey(
    context: CliContext,
): Promise<{ privateJwk: JsonWebKey; publicJwk: JsonWebKey }> {
    const file = path.join(
        context.generatedDir,
        'instances',
        context.instance.name,
        'belcotax',
        'client-key.json',
    );

    let privateJwk: JsonWebKey;
    try {
        privateJwk = JSON.parse(await fs.readFile(file, 'utf8')) as JsonWebKey;
    } catch {
        const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
        privateJwk = { ...privateKey.export({ format: 'jwk' }), alg: 'RS256' };
        privateJwk.kid = thumbprint(privateJwk);
        await fs.mkdir(path.dirname(file), { recursive: true });
        await fs.writeFile(file, JSON.stringify(privateJwk), { mode: 0o600 });
    }

    const publicJwk: JsonWebKey = {
        kty: privateJwk.kty,
        n: privateJwk.n,
        e: privateJwk.e,
        kid: privateJwk.kid,
        use: 'sig',
        alg: 'RS256',
    };
    return { privateJwk, publicJwk };
}

/**
 * RFC 7638 thumbprint of an RSA key
 */
function thumbprint(jwk: JsonWebKey) {
    return createHash('sha256')
        .update(JSON.stringify({ e: jwk.e, kty: jwk.kty, n: jwk.n }))
        .digest('base64url');
}

/**
 * Write the realms Keycloak imports on boot. `dirName` keeps realms of different SSO servers
 * apart: the Playwright server allows other redirect URIs than the one `stam sso start`
 * configures, and both may exist for the same instance.
 */
export async function writeKeycloakRealm(
    context: CliContext,
    redirectUris: string | string[],
    options: { dirName?: string; belcotaxRedirectUris?: string[] } = {},
): Promise<string> {
    const importDir = path.join(
        context.generatedDir,
        'instances',
        context.instance.name,
        options.dirName ?? 'keycloak',
    );
    const file = path.join(importDir, 'stamhoofd-realm.json');
    await fs.mkdir(importDir, { recursive: true });
    await fs.writeFile(file, JSON.stringify(buildKeycloakRealm(redirectUris), null, 4));

    if (options.belcotaxRedirectUris) {
        const realm = buildBelcotaxKeycloakRealm({
            redirectUris: options.belcotaxRedirectUris,
            publicJwk: (await readOrCreateBelcotaxClientKey(context)).publicJwk,
        });
        await fs.writeFile(
            path.join(importDir, 'belcotax-realm.json'),
            JSON.stringify(realm, null, 4),
        );
    }
    return importDir;
}

function splitName(name: string): [string, string] {
    const [firstName, ...lastName] = name.split(' ');
    return [firstName || 'Local', lastName.join(' ') || 'User'];
}
