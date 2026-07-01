import {
    generateAuthenticationOptions,
    generateRegistrationOptions,
    verifyAuthenticationResponse,
    verifyRegistrationResponse,
} from '@simplewebauthn/server';
import type { AuthenticationResponseJSON, AuthenticatorTransportFuture, RegistrationResponseJSON } from '@simplewebauthn/server';
import type { User, WebauthnCredential } from '@stamhoofd/models';
import type { WebauthnAuthenticationCredential, WebauthnRegistrationCredential } from '@stamhoofd/structures';

const RP_NAME = 'Stamhoofd';

const VALID_TRANSPORTS: AuthenticatorTransportFuture[] = ['ble', 'cable', 'hybrid', 'internal', 'nfc', 'smart-card', 'usb'];

/**
 * Narrow an untrusted string[] to valid AuthenticatorTransport values (no unchecked casts).
 */
function coerceTransports(transports: string[] | null | undefined): AuthenticatorTransportFuture[] | undefined {
    if (!transports) {
        return undefined;
    }
    const filtered = transports.filter((t): t is AuthenticatorTransportFuture => (VALID_TRANSPORTS as string[]).includes(t));
    return filtered.length > 0 ? filtered : undefined;
}

/**
 * The WebAuthn Relying Party ID. Passkeys are bound to a single registrable domain, so
 * we scope them to the dashboard domain (admin/staff logins). See the plan for the
 * multi-tenancy constraint.
 */
function getRpID(): string {
    const domain = STAMHOOFD.domains?.dashboard;
    if (!domain) {
        throw new Error('Dashboard domain is required for WebAuthn');
    }
    return domain.split('/')[0].split(':')[0];
}

function getExpectedOrigin(): string {
    return 'https://' + getRpID();
}

export const WebauthnHelper = {
    getRpID,

    async generateRegistration(user: User, existingCredentials: WebauthnCredential[]) {
        return await generateRegistrationOptions({
            rpName: RP_NAME,
            rpID: getRpID(),
            userName: user.email,
            userID: new Uint8Array(Buffer.from(user.id)),
            userDisplayName: user.name || user.email,
            attestationType: 'none',
            excludeCredentials: existingCredentials.map(c => ({
                id: c.credentialId,
                transports: coerceTransports(c.transportsArray),
            })),
            authenticatorSelection: {
                residentKey: 'preferred',
                userVerification: 'preferred',
            },
        });
    },

    /**
     * @returns the verified credential info to persist, or null when verification failed.
     */
    async verifyRegistration(credential: WebauthnRegistrationCredential, expectedChallenge: string) {
        const response: RegistrationResponseJSON = {
            id: credential.id,
            rawId: credential.rawId,
            type: 'public-key',
            clientExtensionResults: {},
            response: {
                clientDataJSON: credential.response.clientDataJSON,
                attestationObject: credential.response.attestationObject,
                authenticatorData: credential.response.authenticatorData ?? undefined,
                transports: coerceTransports(credential.response.transports),
                publicKeyAlgorithm: credential.response.publicKeyAlgorithm ?? undefined,
                publicKey: credential.response.publicKey ?? undefined,
            },
        };

        let verification: Awaited<ReturnType<typeof verifyRegistrationResponse>>;
        try {
            verification = await verifyRegistrationResponse({
                response,
                expectedChallenge,
                expectedOrigin: getExpectedOrigin(),
                expectedRPID: getRpID(),
                requireUserVerification: false,
            });
        }
        catch (e) {
            // Malformed / tampered input makes the library throw; treat as a failed
            // verification instead of surfacing a 500.
            return null;
        }

        if (!verification.verified || !verification.registrationInfo) {
            return null;
        }

        const { credential: verifiedCredential, credentialBackedUp } = verification.registrationInfo;
        return {
            credentialId: verifiedCredential.id,
            publicKey: Buffer.from(verifiedCredential.publicKey).toString('base64url'),
            counter: verifiedCredential.counter,
            transports: verifiedCredential.transports ?? null,
            backedUp: credentialBackedUp,
        };
    },

    async generateAuthentication(credentials: WebauthnCredential[]) {
        return await generateAuthenticationOptions({
            rpID: getRpID(),
            allowCredentials: credentials.map(c => ({
                id: c.credentialId,
                transports: coerceTransports(c.transportsArray),
            })),
            userVerification: 'preferred',
        });
    },

    /**
     * @returns the new signature counter on success, or null when verification failed.
     */
    async verifyAuthentication(credential: WebauthnAuthenticationCredential, expectedChallenge: string, storedCredential: WebauthnCredential): Promise<number | null> {
        const response: AuthenticationResponseJSON = {
            id: credential.id,
            rawId: credential.rawId,
            type: 'public-key',
            clientExtensionResults: {},
            response: {
                clientDataJSON: credential.response.clientDataJSON,
                authenticatorData: credential.response.authenticatorData,
                signature: credential.response.signature,
                userHandle: credential.response.userHandle ?? undefined,
            },
        };

        let verification: Awaited<ReturnType<typeof verifyAuthenticationResponse>>;
        try {
            verification = await verifyAuthenticationResponse({
                response,
                expectedChallenge,
                expectedOrigin: getExpectedOrigin(),
                expectedRPID: getRpID(),
                credential: {
                    id: storedCredential.credentialId,
                    publicKey: new Uint8Array(Buffer.from(storedCredential.publicKey, 'base64url')),
                    counter: storedCredential.counter,
                    transports: coerceTransports(storedCredential.transportsArray),
                },
                requireUserVerification: false,
            });
        }
        catch (e) {
            // Malformed / tampered input makes the library throw; treat as a failed
            // verification instead of surfacing a 500.
            return null;
        }

        if (!verification.verified) {
            return null;
        }
        return verification.authenticationInfo.newCounter;
    },
};
