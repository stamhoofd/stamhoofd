import {
    generateAuthenticationOptions,
    generateRegistrationOptions,
    verifyAuthenticationResponse,
    verifyRegistrationResponse,
} from '@simplewebauthn/server';
import type { AuthenticationResponseJSON, AuthenticatorTransportFuture, RegistrationResponseJSON } from '@simplewebauthn/server';
import type { User, WebauthnCredential } from '@stamhoofd/models';
import type { WebauthnAuthenticationCredential, WebauthnRegistrationCredential } from '@stamhoofd/structures';
import { getWebauthnRpId } from '@stamhoofd/structures';
import aaguids from './data/aaguids.json' with { type: 'json' };
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
 * The WebAuthn Relying Party ID new passkeys are registered against. Passkeys are bound to
 * a single registrable domain, so we scope them to the dashboard domain (admin/staff
 * logins). Shared with the client through @stamhoofd/structures, so both sides agree on
 * which domain passkeys live on.
 */
function getRpID(): string {
    const rpId = getWebauthnRpId();
    if (!rpId) {
        throw new Error('Dashboard domain is required for WebAuthn');
    }
    return rpId;
}

/**
 * The RP ID an existing credential has to be verified against.
 *
 * Credentials created before the RP ID was stored per credential all used the platform RP
 * ID of the time, so that is the fallback.
 */
function getCredentialRpID(credential: WebauthnCredential): string {
    return credential.rpId ?? getRpID();
}

/**
 * Convert a SHA-256 certificate fingerprint to the base64url encoding Android uses in its
 * origin. Accepts the colon separated hexadecimal notation of assetlinks.json, with or
 * without separators.
 */
function fingerprintToBase64URL(fingerprint: string): string {
    const hex = fingerprint.replace(/[\s:-]/g, '');
    if (!/^[0-9a-f]{64}$/i.test(hex)) {
        throw new Error('Invalid SHA-256 certificate fingerprint in ANDROID_PASSKEY_SHA256_CERT_FINGERPRINTS: ' + fingerprint);
    }
    return Buffer.from(hex, 'hex').toString('base64url');
}

/**
 * The origins the Android app presents a passkey from.
 *
 * Android reports the app that made the call instead of the address of the web view:
 * `android:apk-key-hash:<base64url sha-256 of the signing certificate>`. The certificates
 * are configured through ANDROID_PASSKEY_SHA256_CERT_FINGERPRINTS and are the same ones as
 * in the assetlinks.json of the RP ID, which is what makes Android hand our passkeys to
 * the app in the first place.
 */
function getAndroidOrigins(): string[] {
    return (STAMHOOFD.ANDROID_PASSKEY_SHA256_CERT_FINGERPRINTS ?? []).map(fingerprint => 'android:apk-key-hash:' + fingerprintToBase64URL(fingerprint));
}

/**
 * The origins a passkey for `rpId` may be presented from.
 *
 * The web apps run on https. The Capacitor app serves its web view from the same host but
 * a custom scheme (see frontend/app/mobile/capacitor.config.json), which iOS reports as
 * `capacitor://<host>`; Android reports its own signature instead, see getAndroidOrigins.
 *
 * Widening the origin does not widen who can use these passkeys: the app only gets to see
 * them because it is listed in the associated domains (webcredentials / assetlinks.json)
 * of the RP ID, which the operating system verifies before it releases a credential to any
 * app.
 */
function getExpectedOrigins(rpId: string): string[] {
    return ['https://' + rpId, 'capacitor://' + rpId, ...getAndroidOrigins()];
}

export const WebauthnHelper = {
    getRpID,
    getExpectedOrigins,

    async generateRegistration(user: User, existingCredentials: WebauthnCredential[]) {
        return await generateRegistrationOptions({
            rpName: RP_NAME,
            rpID: getRpID(),
            userName: user.email,
            userID: new Uint8Array(Buffer.from(user.id)),
            userDisplayName: user.name || user.email,
            attestationType: 'direct',
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

        const rpId = getRpID();
        const expectedOrigin = getExpectedOrigins(rpId);

        let verification: Awaited<ReturnType<typeof verifyRegistrationResponse>>;
        try {
            verification = await verifyRegistrationResponse({
                response,
                expectedChallenge,
                expectedOrigin,
                expectedRPID: rpId,
                requireUserVerification: false,
            });
        } catch (e) {
            // Malformed / tampered input makes the library throw; treat as a failed
            // verification instead of surfacing a 500.
            return null;
        }

        if (!verification.verified || !verification.registrationInfo) {
            return null;
        }

        const { credential: verifiedCredential, credentialBackedUp, credentialDeviceType, aaguid } = verification.registrationInfo;
        return {
            rpId,
            providerId: aaguid || null,
            providerName: aaguids[aaguid]?.name || null,
            credentialId: verifiedCredential.id,
            publicKey: Buffer.from(verifiedCredential.publicKey).toString('base64url'),
            counter: verifiedCredential.counter,
            transports: verifiedCredential.transports ?? null,
            backedUp: credentialBackedUp,
            backupEligible: credentialDeviceType === 'multiDevice',
        };
    },

    /**
     * Only credentials of the RP ID we are authenticating against can take part: an
     * authenticator will not release a passkey for a different domain. Today they all match,
     * but this is what keeps the challenge correct once more than one domain is in play.
     */
    filterForCurrentRpID(credentials: WebauthnCredential[]): WebauthnCredential[] {
        const rpId = getRpID();
        return credentials.filter(c => getCredentialRpID(c) === rpId);
    },

    async generateAuthentication(credentials: WebauthnCredential[]) {
        return await generateAuthenticationOptions({
            rpID: getRpID(),
            allowCredentials: WebauthnHelper.filterForCurrentRpID(credentials).map(c => ({
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

        // Verify against the RP ID this credential was created for, not the current one.
        const rpId = getCredentialRpID(storedCredential);
        const expectedOrigin = getExpectedOrigins(rpId);

        let verification: Awaited<ReturnType<typeof verifyAuthenticationResponse>>;
        try {
            verification = await verifyAuthenticationResponse({
                response,
                expectedChallenge,
                expectedOrigin,
                expectedRPID: rpId,
                credential: {
                    id: storedCredential.credentialId,
                    publicKey: new Uint8Array(Buffer.from(storedCredential.publicKey, 'base64url')),
                    counter: storedCredential.counter,
                    transports: coerceTransports(storedCredential.transportsArray),
                },
                requireUserVerification: false,
            });
        } catch (e) {
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
