import { column } from '@simonbackx/simple-database';
import { QueryableModel } from '@stamhoofd/sql';
import crypto from 'crypto';

export type MFATokenPurpose = 'login' | 'setup';

/**
 * A short-lived, single-use session token issued during a login that requires a second
 * factor ('login') or forced 2FA enrollment ('setup'). Mirrors EmailVerificationCode.
 */
export class MFAToken extends QueryableModel {
    static table = 'mfa_tokens';
    static MAX_TRIES = 5;
    static EXPIRY_MS = 15 * 60 * 1000;

    @column({ primary: true, type: 'string' })
    token: string;

    @column({ type: 'string' })
    userId: string;

    @column({ type: 'string' })
    purpose: MFATokenPurpose = 'login';

    @column({ type: 'integer' })
    tries = 0;

    /**
     * The pending WebAuthn authentication challenge for passkey login (if any).
     */
    @column({ type: 'string', nullable: true })
    webauthnChallenge: string | null = null;

    @column({ type: 'datetime' })
    expiresAt: Date;

    @column({
        type: 'datetime', beforeSave(old?: any) {
            if (old !== undefined) {
                return old;
            }
            const date = new Date();
            date.setMilliseconds(0);
            return date;
        },
    })
    createdAt: Date;

    @column({
        type: 'datetime', beforeSave() {
            const date = new Date();
            date.setMilliseconds(0);
            return date;
        },
        skipUpdate: true,
    })
    updatedAt: Date;

    static async createFor(userId: string, purpose: MFATokenPurpose, webauthnChallenge: string | null = null): Promise<MFAToken> {
        const model = new MFAToken();
        model.token = crypto.randomBytes(48).toString('base64url');
        model.userId = userId;
        model.purpose = purpose;
        model.webauthnChallenge = webauthnChallenge;
        model.expiresAt = new Date(Date.now() + MFAToken.EXPIRY_MS);
        await model.save();
        return model;
    }

    isExpired(): boolean {
        return this.expiresAt < new Date();
    }

    /**
     * Look up a valid, non-expired, non-locked token for the given purpose. Deletes it if
     * expired. Does not consume it (call consume() after a successful verification).
     */
    static async getValid(token: string, purpose: MFATokenPurpose): Promise<MFAToken | undefined> {
        if (!token) {
            return undefined;
        }
        const model = await this.select().where('token', token).first(false);
        if (!model || model.purpose !== purpose) {
            return undefined;
        }
        if (model.isExpired()) {
            await model.delete();
            return undefined;
        }
        if (model.tries >= MFAToken.MAX_TRIES) {
            return undefined;
        }
        return model;
    }

    /**
     * Register a failed attempt. Returns true if the token is now locked out.
     */
    async registerFailedAttempt(): Promise<boolean> {
        this.tries += 1;
        await this.save();
        return this.tries >= MFAToken.MAX_TRIES;
    }

    async consume(): Promise<void> {
        await this.delete();
    }
}
