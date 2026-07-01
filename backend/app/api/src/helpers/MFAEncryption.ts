import crypto from 'crypto';

/**
 * Symmetric encryption for TOTP secrets at rest. The key is derived from
 * STAMHOOFD.INTERNAL_SECRET_KEY so we don't need a separate provisioned secret.
 */
const ALGORITHM = 'aes-256-gcm';

function getKey(): Buffer {
    const base = STAMHOOFD.INTERNAL_SECRET_KEY;
    if (!base) {
        throw new Error('INTERNAL_SECRET_KEY is required to encrypt MFA secrets');
    }
    return crypto.createHash('sha256').update(base + ':mfa-totp-secret').digest();
}

export function encryptMFASecret(plaintext: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [iv.toString('base64'), tag.toString('base64'), encrypted.toString('base64')].join(':');
}

export function decryptMFASecret(payload: string): string {
    const parts = payload.split(':');
    if (parts.length !== 3) {
        throw new Error('Invalid encrypted MFA secret');
    }
    const [ivB64, tagB64, dataB64] = parts;
    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
}
