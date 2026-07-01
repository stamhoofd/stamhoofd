import * as argon2 from 'argon2';
import basex from 'base-x';
import crypto from 'crypto';

import { MFARecoveryCode } from '@stamhoofd/models';

const RECOVERY_CODE_COUNT = 10;
const CODE_LENGTH = 16;

// No 0, O, I or L, to make the codes easier for humans to read. Mirrors
// Member.generateSecurityCode.
export const RECOVERY_CODE_ALPHABET = '123456789ABCDEFGHJKMNPQRSTUVWXYZ';
const recoveryCodeBase = basex(RECOVERY_CODE_ALPHABET);

/**
 * A single recovery code: 16 symbols (~80 bits) from the base-x encoding of random
 * bytes, formatted as XXXX-XXXX-XXXX-XXXX. Uses base-x (like Member.generateSecurityCode)
 * rather than hand-rolled modulo indexing.
 */
function randomCode(): string {
    const raw = recoveryCodeBase.encode(crypto.randomBytes(100)).toUpperCase().substring(0, CODE_LENGTH);
    return raw.replace(/(.{4})(.{4})(.{4})(.{4})/, '$1-$2-$3-$4');
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
     * found. The row is claimed with a conditional `UPDATE ... WHERE usedAt IS NULL`, so
     * two concurrent requests can never both consume the same code.
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
                    // Atomically claim the code: only the first request whose UPDATE
                    // matches (usedAt still NULL) wins the race.
                    const result = await MFARecoveryCode.update()
                        .set('usedAt', new Date())
                        .where('id', candidate.id)
                        .where('usedAt', null)
                        .update();
                    return result.changedRows === 1;
                }
            }
            catch (e) {
                // Ignore malformed hash, keep checking
            }
        }
        return false;
    },
};
