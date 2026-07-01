import { startRegistration } from '@simplewebauthn/browser';
import type { PublicKeyCredentialCreationOptionsJSON } from '@simplewebauthn/browser';
import type { Decoder } from '@simonbackx/simple-encoding';
import type { RequestInitializer } from '@simonbackx/simple-networking';
import { MFAEnrollmentResult, MFAStatus, RecoveryCodes, TOTPSetupResponse, WebauthnAttestationResponseData, WebauthnRegistrationCredential, WebauthnRegistrationOptions, WebauthnRegistrationRequest } from '@stamhoofd/structures';

import type { SessionContext } from './SessionContext';
import { SessionManager } from './SessionManager';

/**
 * Client for the 2FA enrollment/management endpoints.
 *
 * When a `setupToken` is provided (forced enrollment during login, before a session
 * exists), requests are authorized with the `MFASetup` scheme on the identity server.
 * Otherwise the authenticated server (Bearer) is used, which the backend additionally
 * requires to be "fresh".
 */
export class MFAManager {
    private static async request<T>(session: SessionContext, options: RequestInitializer<T>, setupToken?: string): Promise<T> {
        const server = setupToken ? session.identityServer : session.authenticatedServer;
        const headers = setupToken ? { Authorization: 'MFASetup ' + setupToken } : undefined;
        const response = await server.request({ ...options, headers, shouldRetry: false });
        return response.data;
    }

    static getStatus(session: SessionContext): Promise<MFAStatus> {
        return this.request(session, { method: 'GET', path: '/mfa', decoder: MFAStatus as Decoder<MFAStatus> });
    }

    static setupTotp(session: SessionContext, setupToken?: string): Promise<TOTPSetupResponse> {
        return this.request(session, { method: 'POST', path: '/mfa/totp', decoder: TOTPSetupResponse as Decoder<TOTPSetupResponse> }, setupToken);
    }

    static confirmTotp(session: SessionContext, totpId: string, code: string, name: string, setupToken?: string): Promise<MFAEnrollmentResult> {
        return this.request(session, {
            method: 'POST',
            path: '/mfa/totp/' + encodeURIComponent(totpId) + '/confirm',
            body: { code, name },
            decoder: MFAEnrollmentResult as Decoder<MFAEnrollmentResult>,
        }, setupToken);
    }

    static async registerPasskey(session: SessionContext, name: string, setupToken?: string): Promise<MFAEnrollmentResult> {
        const options = await this.request<WebauthnRegistrationOptions>(session, {
            method: 'POST',
            path: '/mfa/passkeys/options',
            decoder: WebauthnRegistrationOptions as Decoder<WebauthnRegistrationOptions>,
        }, setupToken);

        // options.options is opaque JSON from our own server (@simplewebauthn), handed
        // straight to the browser API, so we assert the concrete type here.
        const browserResponse = await startRegistration({ optionsJSON: options.options as PublicKeyCredentialCreationOptionsJSON });

        // Map the browser response into our validated structure before sending.
        const body = WebauthnRegistrationRequest.create({
            name,
            response: WebauthnRegistrationCredential.create({
                id: browserResponse.id,
                rawId: browserResponse.rawId,
                type: browserResponse.type,
                response: WebauthnAttestationResponseData.create({
                    clientDataJSON: browserResponse.response.clientDataJSON,
                    attestationObject: browserResponse.response.attestationObject,
                    authenticatorData: browserResponse.response.authenticatorData ?? null,
                    transports: browserResponse.response.transports ?? [],
                    publicKeyAlgorithm: browserResponse.response.publicKeyAlgorithm ?? null,
                    publicKey: browserResponse.response.publicKey ?? null,
                }),
            }),
        });

        return this.request(session, {
            method: 'POST',
            path: '/mfa/passkeys',
            body,
            decoder: MFAEnrollmentResult as Decoder<MFAEnrollmentResult>,
        }, setupToken);
    }

    static regenerateRecoveryCodes(session: SessionContext): Promise<RecoveryCodes> {
        return this.request(session, { method: 'POST', path: '/mfa/recovery-codes', decoder: RecoveryCodes as Decoder<RecoveryCodes> });
    }

    static deleteTotp(session: SessionContext, id: string): Promise<MFAStatus> {
        return this.request(session, { method: 'DELETE', path: '/mfa/totp/' + encodeURIComponent(id), decoder: MFAStatus as Decoder<MFAStatus> });
    }

    static deletePasskey(session: SessionContext, id: string): Promise<MFAStatus> {
        return this.request(session, { method: 'DELETE', path: '/mfa/passkeys/' + encodeURIComponent(id), decoder: MFAStatus as Decoder<MFAStatus> });
    }

    /**
     * After a forced-enrollment action, the result contains a fresh session token. Apply
     * it to log the user in.
     */
    static async applyEnrollmentResult(session: SessionContext, result: MFAEnrollmentResult): Promise<void> {
        if (!result.token) {
            return;
        }
        session.preventComplete = true;
        try {
            await session.setToken(result.token);
            await SessionManager.prepareSessionForUsage(session);
        }
        finally {
            session.preventComplete = false;
        }
    }
}
