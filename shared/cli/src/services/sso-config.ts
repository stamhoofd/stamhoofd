import fs from 'node:fs/promises';
import path from 'node:path';
import type { CliContext } from '../context/create-context.js';

export const ssoRealm = 'stamhoofd';
export const ssoClientId = 'stamhoofd-local';
export const ssoClientSecret = 'stamhoofd-local-secret';
export const ssoUserEmail = 'sso@example.com';
export const ssoUserPassword = 'password';
export const ssoUserName = 'Local SSO User';
export const ssoAdminUser = 'admin';
export const ssoAdminPassword = 'admin';

export function buildKeycloakRealm(redirectUri: string): Record<string, unknown> {
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
                redirectUris: [redirectUri],
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

export async function writeKeycloakRealm(context: CliContext, redirectUri: string): Promise<string> {
    const importDir = path.join(context.generatedDir, 'instances', context.instance.name, 'keycloak');
    const file = path.join(importDir, 'stamhoofd-realm.json');
    await fs.mkdir(importDir, { recursive: true });
    await fs.writeFile(file, JSON.stringify(buildKeycloakRealm(redirectUri), null, 4));
    return importDir;
}

function splitName(name: string): [string, string] {
    const [firstName, ...lastName] = name.split(' ');
    return [firstName || 'Local', lastName.join(' ') || 'User'];
}
