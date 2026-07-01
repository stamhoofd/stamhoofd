import { authenticator } from 'otplib';

import { decryptMFASecret, encryptMFASecret } from './MFAEncryption.js';

// Allow a ±1 step (±30s) tolerance to account for clock drift.
const WINDOW = 1;

/**
 * Reset the shared otplib singleton to our defaults, optionally pinning the epoch (ms) so
 * that a verification's returned delta and the counter we derive from it are computed from
 * the exact same instant. Pass no argument to restore the live-clock behaviour.
 */
function configureAuthenticator(epoch?: number) {
    authenticator.resetOptions();
    authenticator.options = epoch === undefined ? { window: WINDOW } : { window: WINDOW, epoch };
}

configureAuthenticator();

export const TOTPHelper = {
    /**
     * Generate a fresh base32 secret (plaintext, to show once to the user).
     */
    generateSecret(): string {
        return authenticator.generateSecret();
    },

    /**
     * Build the otpauth:// URI used to render the QR code.
     */
    keyuri(accountName: string, secret: string): string {
        const service = STAMHOOFD.domains?.dashboard ?? 'Stamhoofd';
        return authenticator.keyuri(accountName, service, secret);
    },

    encrypt(secret: string): string {
        return encryptMFASecret(secret);
    },

    /**
     * Verify a 6-digit code against an encrypted secret. Returns the absolute TOTP step
     * counter that matched (which increases monotonically over time), or null when the
     * code is invalid.
     *
     * Callers MUST reject a counter that is not strictly greater than the last counter
     * they accepted for the same authenticator, otherwise a still-valid code can be
     * replayed within its window (RFC 6238 §5.2).
     */
    verify(code: string, encryptedSecret: string): number | null {
        const trimmed = (code ?? '').trim();
        if (!/^\d{6}$/.test(trimmed)) {
            return null;
        }
        try {
            const secret = decryptMFASecret(encryptedSecret);
            const now = Date.now();
            const step = authenticator.allOptions().step ?? 30;

            // Pin the epoch so checkDelta() and our counter are derived from the same
            // instant (otherwise a step boundary crossing between the two reads could
            // produce an off-by-one counter).
            configureAuthenticator(now);
            let delta: number | null;
            try {
                delta = authenticator.checkDelta(trimmed, secret);
            }
            finally {
                configureAuthenticator();
            }

            if (delta === null) {
                return null;
            }
            return Math.floor(now / 1000 / step) + delta;
        }
        catch (e) {
            return null;
        }
    },
};
