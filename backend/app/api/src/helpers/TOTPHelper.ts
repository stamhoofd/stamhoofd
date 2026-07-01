import { authenticator } from 'otplib';

import { decryptMFASecret, encryptMFASecret } from './MFAEncryption.js';

// Allow a ±1 step (±30s) tolerance to account for clock drift.
authenticator.options = { window: 1 };

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
     * Verify a 6-digit code against an encrypted secret. Returns false on any error.
     */
    verify(code: string, encryptedSecret: string): boolean {
        const trimmed = (code ?? '').trim();
        if (!/^\d{6}$/.test(trimmed)) {
            return false;
        }
        try {
            return authenticator.check(trimmed, decryptMFASecret(encryptedSecret));
        }
        catch (e) {
            return false;
        }
    },
};
