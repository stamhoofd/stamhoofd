import { AnyDecoder, ArrayDecoder, AutoEncoder, BooleanDecoder, DateDecoder, EnumDecoder, field, IntegerDecoder, StringDecoder } from '@simonbackx/simple-encoding';

import { Token } from './Token.js';

/**
 * The multi-factor authentication methods a user can use as a second factor.
 */
export enum MFAMethodType {
    TOTP = 'TOTP',
    Passkey = 'Passkey',
    RecoveryCode = 'RecoveryCode',
}

export function getMFAMethodTypeName(method: MFAMethodType): string {
    switch (method) {
        case MFAMethodType.TOTP:
            return $t(`%ZgY`);
        case MFAMethodType.Passkey:
            return $t(`%Zhp`);
        case MFAMethodType.RecoveryCode:
            return $t(`%ZhI`);
    }
}

/**
 * The WebAuthn Relying Party ID that passkeys are bound to.
 *
 * A passkey only works on the domain it was created for (or a subdomain of it), so all
 * passkeys are scoped to the dashboard domain. Returns null when no dashboard domain is
 * configured, in which case passkeys cannot be used at all.
 *
 * Shared between the client and the server on purpose: the server verifies against this
 * RP ID, and the client has to know whether the browser it runs in is allowed to use it.
 */
export function getWebauthnRpId(): string | null {
    const domain = STAMHOOFD.domains?.dashboard;
    if (!domain) {
        return null;
    }
    // The configured domain can carry a path and/or a port; an RP ID is a bare hostname.
    return domain.split('/')[0].split(':')[0] || null;
}

/**
 * Whether a browser served from `hostname` may create or use passkeys for our RP ID.
 *
 * WebAuthn only accepts an RP ID that is the origin's own domain or a registrable suffix
 * of it, so an organization on a custom or registration domain cannot touch the passkeys
 * that live on the dashboard domain.
 */
export function isWebauthnRpIdUsableOn(hostname: string): boolean {
    const rpId = getWebauthnRpId();
    if (!rpId) {
        return false;
    }
    return hostname === rpId || hostname.endsWith('.' + rpId);
}

/**
 * Ask for the challenge that belongs to a pending login MFA token. Used by the SSO flow,
 * where the token comes back through a browser redirect instead of an error response.
 */
export class MFAChallengeRequest extends AutoEncoder {
    @field({ decoder: StringDecoder })
    token = '';
}

/**
 * Sent as the `meta` of a `require_mfa` error when a password login succeeded but a
 * second factor is required. The client uses `token` to complete the `mfa` grant.
 */
export class MFAChallengeResponse extends AutoEncoder {
    /**
     * The short-lived, single-use MFA session token.
     */
    @field({ decoder: StringDecoder })
    token = '';

    /**
     * The second factors the user has enrolled and can use to complete this login.
     */
    @field({ decoder: new ArrayDecoder(new EnumDecoder(MFAMethodType)) })
    methods: MFAMethodType[] = [];

    /**
     * WebAuthn authentication options (PublicKeyCredentialRequestOptionsJSON) generated
     * by @simplewebauthn/server on OUR server, passed through to the browser's
     * startAuthentication(). This is trusted server output (not user input), so it is
     * kept opaque. Only set when the user has passkeys.
     */
    @field({ decoder: AnyDecoder, nullable: true })
    webauthnAuthenticationOptions: unknown = null;
}

/**
 * Sent as the `meta` of a `require_mfa_setup` error when a user is required to have 2FA
 * but has none enrolled yet. The client uses `setupToken` to authorize enrollment.
 */
export class MFASetupResponse extends AutoEncoder {
    @field({ decoder: StringDecoder })
    setupToken = '';

    /**
     * Whether this account may enroll a passkey. There is no session yet at this point, so
     * the client cannot read it from the MFA status.
     */
    @field({ decoder: BooleanDecoder })
    canUsePasskeys = false;

    /**
     * A normal session token, only handed out when the primary credential was a password
     * token (invite / password reset link). The user has no second factor yet, so anyone
     * holding that link could enroll a factor of their own and obtain a session anyway:
     * handing out the session right away is equally strong, and it lets the client first
     * walk the user through choosing a password before enrolling.
     *
     * Null for every other grant: there the client should complete the enrollment with
     * `setupToken` to obtain a session.
     */
    @field({ decoder: Token, nullable: true })
    token: Token | null = null;
}

/**
 * Returned by the TOTP setup endpoint. The `secret` is shown once so the user can add it
 * to their authenticator app; the client renders the QR code itself from `otpauthUri`.
 */
export class TOTPSetupResponse extends AutoEncoder {
    @field({ decoder: StringDecoder })
    totpId = '';

    @field({ decoder: StringDecoder })
    secret = '';

    @field({ decoder: StringDecoder })
    otpauthUri = '';
}

/**
 * Request body to confirm a TOTP authenticator (verify the first code + name it).
 */
export class TOTPConfirmRequest extends AutoEncoder {
    @field({ decoder: StringDecoder })
    code = '';

    @field({ decoder: StringDecoder })
    name = '';
}

/**
 * A TOTP authenticator shown in the account settings list.
 */
export class TOTPCredential extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id = '';

    @field({ decoder: StringDecoder })
    name = '';

    @field({ decoder: DateDecoder })
    createdAt = new Date();

    @field({ decoder: DateDecoder, nullable: true })
    lastUsedAt: Date | null = null;
}

/**
 * A passkey shown in the account settings list.
 */
export class PasskeyCredential extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id = '';

    @field({ decoder: StringDecoder })
    name = '';

    @field({ decoder: StringDecoder, nullable: true })
    providerId: string | null;

    @field({ decoder: StringDecoder, nullable: true })
    providerName: string | null;

    @field({ decoder: new ArrayDecoder(StringDecoder) })
    transports: string[];

    @field({ decoder: DateDecoder })
    createdAt = new Date();

    @field({ decoder: DateDecoder, nullable: true })
    lastUsedAt: Date | null = null;

    get derivedName() {
        return this.name || this.providerName || $t('%Zhp');
    }

    get icon() {
        if (this.providerName === '1Password') {
            return 'one-password';
        }

        if (this.providerName?.toLocaleLowerCase().includes('apple')) {
            return 'apple';
        }

        if (this.providerName?.toLocaleLowerCase().includes('google') || this.providerName?.toLocaleLowerCase().includes('chrome')) {
            return 'google';
        }

        if (this.providerName?.toLocaleLowerCase().includes('yubikey') || ((this.transports.includes('usb') || this.transports.includes('nfc')) && !this.transports.includes('hybrid'))) {
            return 'security-key';
        }
        return 'key';
    }
}

/**
 * A freshly generated batch of recovery codes. Only ever returned once, right after
 * generation. The server only stores hashes.
 */
export class RecoveryCodes extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(StringDecoder) })
    codes: string[] = [];
}

/**
 * Overview of the user's enrolled factors, used to render the settings screen.
 */
export class MFAStatus extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(TOTPCredential) })
    totp: TOTPCredential[] = [];

    @field({ decoder: new ArrayDecoder(PasskeyCredential) })
    passkeys: PasskeyCredential[] = [];

    @field({ decoder: BooleanDecoder })
    hasRecoveryCodes = false;

    @field({ decoder: IntegerDecoder })
    recoveryCodesRemaining = 0;

    /**
     * Whether this account may enroll passkeys. See User.canUsePasskeys: passkeys are bound
     * to a single domain, so they are limited to platform level accounts for now.
     */
    @field({ decoder: BooleanDecoder })
    canUsePasskeys = false;
}

/**
 * Response of an enrollment action. `token` is only set during forced enrollment (the
 * setup-token flow), where completing the first factor also logs the user in.
 * `recoveryCodes` is only set when this was the user's first factor.
 */
export class MFAEnrollmentResult extends AutoEncoder {
    @field({ decoder: MFAStatus })
    status: MFAStatus = MFAStatus.create({});

    @field({ decoder: Token, nullable: true })
    token: Token | null = null;

    @field({ decoder: RecoveryCodes, nullable: true })
    recoveryCodes: RecoveryCodes | null = null;
}

/**
 * WebAuthn registration options (PublicKeyCredentialCreationOptionsJSON) generated by
 * @simplewebauthn/server on OUR server, passed through to the browser's
 * startRegistration(). Trusted server output (not user input), kept opaque.
 */
export class WebauthnRegistrationOptions extends AutoEncoder {
    @field({ decoder: AnyDecoder, nullable: true })
    options: unknown = null;
}

// --- WebAuthn credential payloads (UNTRUSTED USER INPUT — fully decoded/validated) ---

/**
 * The inner `response` of a WebAuthn authentication assertion (browser output).
 */
export class WebauthnAssertionResponseData extends AutoEncoder {
    @field({ decoder: StringDecoder })
    clientDataJSON = '';

    @field({ decoder: StringDecoder })
    authenticatorData = '';

    @field({ decoder: StringDecoder })
    signature = '';

    @field({ decoder: StringDecoder, nullable: true })
    userHandle: string | null = null;
}

/**
 * A WebAuthn authentication assertion (AuthenticationResponseJSON) submitted by the
 * client to complete a passkey login. Decoded + validated as a structure.
 */
export class WebauthnAuthenticationCredential extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id = '';

    @field({ decoder: StringDecoder })
    rawId = '';

    @field({ decoder: StringDecoder })
    type = 'public-key';

    @field({ decoder: WebauthnAssertionResponseData })
    response: WebauthnAssertionResponseData = WebauthnAssertionResponseData.create({});
}

/**
 * The inner `response` of a WebAuthn attestation (registration; browser output).
 */
export class WebauthnAttestationResponseData extends AutoEncoder {
    @field({ decoder: StringDecoder })
    clientDataJSON = '';

    @field({ decoder: StringDecoder })
    attestationObject = '';

    @field({ decoder: StringDecoder, nullable: true })
    authenticatorData: string | null = null;

    @field({ decoder: new ArrayDecoder(StringDecoder) })
    transports: string[] = [];

    @field({ decoder: IntegerDecoder, nullable: true })
    publicKeyAlgorithm: number | null = null;

    @field({ decoder: StringDecoder, nullable: true })
    publicKey: string | null = null;
}

/**
 * A WebAuthn registration attestation (RegistrationResponseJSON) submitted by the client
 * when enrolling a passkey. Decoded + validated as a structure.
 */
export class WebauthnRegistrationCredential extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id = '';

    @field({ decoder: StringDecoder })
    rawId = '';

    @field({ decoder: StringDecoder })
    type = 'public-key';

    @field({ decoder: WebauthnAttestationResponseData })
    response: WebauthnAttestationResponseData = WebauthnAttestationResponseData.create({});
}

/**
 * The client's decoded registration credential returned by startRegistration(), plus a
 * user-provided name for the passkey.
 */
export class WebauthnRegistrationRequest extends AutoEncoder {
    @field({ decoder: WebauthnRegistrationCredential })
    response: WebauthnRegistrationCredential = WebauthnRegistrationCredential.create({});

    @field({ decoder: StringDecoder, nullable: true })
    name: string | null;
}

/**
 * Request body to rename an enrolled credential (TOTP authenticator or passkey).
 */
export class MFACredentialRenameRequest extends AutoEncoder {
    @field({ decoder: StringDecoder })
    name = '';
}
