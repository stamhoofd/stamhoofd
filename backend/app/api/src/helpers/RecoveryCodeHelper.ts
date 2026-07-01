import * as argon2 from 'argon2';
import crypto from 'crypto';

import { MFARecoveryCode } from '@stamhoofd/models';

const RECOVERY_CODE_COUNT = 10;
// 10 bytes of entropy encoded as base32 -> 16 chars, formatted as XXXX-XXXX-XXXX-XXXX.
const ALPHABET = 'ABCDEFGHIJKLMNPQRSTUVWXYZ23456789'; // Crockford-ish, no confusing chars

function randomCode(): string {
    const bytes = crypto.randomBytes(10);
    let out = '';
    for (let i = 0; i < bytes.length; i++) {
        out += ALPHABET[bytes[i] % ALPHABET.length];
    }
    // Extra chars to reach 16
    const extra = crypto.randomBytes(6);
    for (let i = 0; i < extra.length; i++) {
        out += ALPHABET[extra[i] % ALPHABET.length];
    }
    return out.slice(0, 16).replace(/(.{4})(.{4})(.{4})(.{4})/, '$1-$2-$3-$4');
}

function normalize(code: string): string {
    return (code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export const RecoveryCodeHelper = {
    /**
     * Generate a new batch of recovery codes for a user, replacing any existing batch.
     * Returns the plaintext codes (only shown once). Only Argon2 hashes are stored.
     */
    async regenerateForUser(userId: string): Promise<string[]> {
        await MFARecoveryCode.deleteForUser(userId);

        const codes: string[] = [];
        for (let i = 0; i < RECOVERY_CODE_COUNT; i++) {
            const code = randomCode();
            codes.push(code);

            const model = new MFARecoveryCode();
            model.userId = userId;
            model.codeHash = await argon2.hash(normalize(code));
            await model.save();
        }
        return codes;
    },

    /**
     * Verify and consume a recovery code. Returns true if a matching unused code was
     * found (and marks it used).
     */
    async consume(userId: string, code: string): Promise<boolean> {
        const normalized = normalize(code);
        if (normalized.length === 0) {
            return false;
        }

        const unused = await MFARecoveryCode.getUnusedForUser(userId);
        for (const candidate of unused) {
            try {
                if (await argon2.verify(candidate.codeHash, normalized)) {
                    candidate.usedAt = new Date();
                    await candidate.save();
                    return true;
                }
            }
            catch (e) {
                // Ignore malformed hash, keep checking
            }
        }
        return false;
    },
};
