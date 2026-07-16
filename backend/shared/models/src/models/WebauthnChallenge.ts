import { column } from '@simonbackx/simple-database';
import { QueryableModel } from '@stamhoofd/sql';
import { v4 as uuidv4 } from 'uuid';

/**
 * A short-lived, single-use WebAuthn registration challenge for a logged-in user, kept
 * server-side so the registration response can be verified against it.
 */
export class WebauthnChallenge extends QueryableModel {
    static table = 'webauthn_challenges';
    static EXPIRY_MS = 10 * 60 * 1000;

    @column({
        primary: true, type: 'string', beforeSave(value) {
            return value ?? uuidv4();
        },
    })
    id!: string;

    @column({ type: 'string' })
    userId: string;

    @column({ type: 'string' })
    challenge: string;

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

    static async createFor(userId: string, challenge: string): Promise<WebauthnChallenge> {
        // Only keep one pending registration challenge per user
        await this.delete().where('userId', userId);

        const model = new WebauthnChallenge();
        model.userId = userId;
        model.challenge = challenge;
        model.expiresAt = new Date(Date.now() + WebauthnChallenge.EXPIRY_MS);
        await model.save();
        return model;
    }

    isExpired(): boolean {
        return this.expiresAt < new Date();
    }

    /**
     * Consume the latest pending challenge for a user. Returns the challenge string, or
     * undefined if none valid. Always deletes the row.
     */
    static async consumeForUser(userId: string): Promise<string | undefined> {
        const model = await this.select().where('userId', userId).first(false);
        if (!model) {
            return undefined;
        }
        const challenge = model.challenge;
        const expired = model.isExpired();
        await model.delete();
        return expired ? undefined : challenge;
    }
}
