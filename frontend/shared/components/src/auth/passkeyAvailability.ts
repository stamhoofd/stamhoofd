import { getWebauthnRpId, isWebauthnRpIdUsableOn } from '@stamhoofd/structures';

/**
 * Why passkeys cannot be used right here, right now.
 *
 * `unsupported` - this browser or web view has no WebAuthn at all.
 * `domain` - passkeys live on the dashboard domain, and this page is served from another
 *   one (an organization's custom or registration domain). The browser would refuse the
 *   RP ID with an error nobody can act on, so we say it up front.
 */
export type PasskeyUnavailableReason = 'unsupported' | 'domain';

/**
 * Whether the browser this page runs in can create and use passkeys for our RP ID.
 * Returns null when it can.
 *
 * The native apps qualify too: their web view is served from the dashboard host (see the
 * hostname in capacitor.config.json) and the apps are listed in its associated domains, so
 * the operating system hands them the same passkeys. Only the scheme differs, which the
 * server accounts for.
 *
 * This is about the page, not about the account: whether the ACCOUNT may use passkeys is
 * decided by the server (see MFAStatus.canUsePasskeys).
 */
export function getPasskeyUnavailableReason(): PasskeyUnavailableReason | null {
    if (typeof window === 'undefined' || typeof window.PublicKeyCredential === 'undefined') {
        return 'unsupported';
    }

    if (!isWebauthnRpIdUsableOn(window.location.hostname)) {
        return 'domain';
    }

    return null;
}

export function canUsePasskeysOnThisDomain(): boolean {
    return getPasskeyUnavailableReason() === null;
}

/**
 * Where the user has to be to manage or use their passkeys.
 */
export function getPasskeyDomain(): string {
    return getWebauthnRpId() ?? '';
}
