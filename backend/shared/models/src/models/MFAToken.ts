import { column } from '@simonbackx/simple-database';
import { QueryableModel, SQLCalculation, SQLColumnExpression, SQLScalar, SQLWhereSign } from '@stamhoofd/sql';
import crypto from 'crypto';
import type { SessionLoginMethod } from './Token.js';

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

    /**
     * The primary credential that was accepted before this challenge was created. The
     * session is only created once the challenge is completed, and it has to know how the
     * user got there.
     */
    @column({ type: 'string' })
    loginMethod: SessionLoginMethod = 'password';

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

    static async createFor(userId: string, purpose: MFATokenPurpose, { webauthnChallenge = null, loginMethod = 'password' }: { webauthnChallenge?: string | null; loginMethod?: SessionLoginMethod } = {}): Promise<MFAToken> {
        // A new attempt supersedes the previous one. Without this, every single login
        // attempt of a user with 2FA leaves a row behind (anyone who knows the password
        // can create them at will), and the abandoned tokens stay usable until they
        // expire. Only one challenge per purpose can be outstanding at a time.
        await this.delete().where('userId', userId).where('purpose', purpose).delete();

        const model = new MFAToken();
        model.token = crypto.randomBytes(48).toString('base64url');
        model.userId = userId;
        model.purpose = purpose;
        model.loginMethod = loginMethod;
        model.webauthnChallenge = webauthnChallenge;
        model.expiresAt = new Date(Date.now() + MFAToken.EXPIRY_MS);
        await model.save();
        return model;
    }

    /**
     * Remove every expired token. Tokens are also dropped when they are looked up after
     * expiring, but a token that is never used again would stay behind forever.
     */
    static async deleteExpired(): Promise<number> {
        const { affectedRows } = await this.delete().where('expiresAt', SQLWhereSign.Less, new Date()).delete();
        return affectedRows;
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
     *
     * The counter is incremented in the database rather than read-modify-written, so that
     * guesses sent in parallel each cost a try. Reading the value first would let an
     * attacker fire MAX_TRIES requests at once and have them all write back `1`.
     */
    async registerFailedAttempt(): Promise<boolean> {
        await MFAToken.update()
            .set('tries', new SQLCalculation(new SQLColumnExpression('tries')).add(new SQLScalar(1)))
            .where('token', this.token)
            .update();

        const updated = await MFAToken.select().where('token', this.token).first(false);
        this.tries = updated?.tries ?? this.tries + 1;
        return this.tries >= MFAToken.MAX_TRIES;
    }

    /**
     * Claim this token. Returns false when another request already consumed it: a single
     * challenge may only ever hand out one session, even when two requests verify the same
     * second factor at the same time.
     */
    async consume(): Promise<boolean> {
        const { affectedRows } = await MFAToken.delete().where('token', this.token).delete();
        return affectedRows === 1;
    }
}
