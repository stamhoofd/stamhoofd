import { column } from '@simonbackx/simple-database';
import { QueryableModel, SQLWhereSign } from '@stamhoofd/sql';
import crypto from 'crypto';

/**
 * A one-time ticket an administrator trades for a session that impersonates another user.
 *
 * The ticket travels through a link that has to be opened in a fresh (private) browser
 * session, so it is handled as a credential: single use, short lived, and only valid from
 * the address that asked for it.
 */
export class ImpersonationToken extends QueryableModel {
    static table = 'impersonation_tokens';

    /**
     * Long enough for the administrator to open a private window and confirm, short enough
     * that a leaked link is worthless by the time it is read.
     */
    static EXPIRY_MS = 5 * 60 * 1000;

    @column({ primary: true, type: 'string' })
    token: string;

    /**
     * The administrator that will act through the session.
     */
    @column({ type: 'string' })
    userId: string;

    /**
     * The account the session will present itself as.
     */
    @column({ type: 'string' })
    impersonatedUserId: string;

    /**
     * The organization the impersonation was started from, used to scope the audit log.
     */
    @column({ type: 'string', nullable: true })
    organizationId: string | null = null;

    /**
     * The address the ticket was requested from. The link only works from that same
     * address, so a link that is forwarded to someone else is useless to them.
     *
     * Trustworthy because Caddy overwrites X-Forwarded-For in production: a client cannot
     * claim an address of its own choosing.
     */
    @column({ type: 'string' })
    createdIp: string;

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

    static async createFor(data: { userId: string; impersonatedUserId: string; organizationId: string | null; ip: string }): Promise<ImpersonationToken> {
        // Only one outstanding ticket per administrator: asking for a new link invalidates
        // the previous one, so an abandoned link cannot be picked up later.
        await this.delete().where('userId', data.userId).delete();

        const model = new ImpersonationToken();
        model.token = crypto.randomBytes(48).toString('base64url');
        model.userId = data.userId;
        model.impersonatedUserId = data.impersonatedUserId;
        model.organizationId = data.organizationId;
        model.createdIp = data.ip;
        model.expiresAt = new Date(Date.now() + ImpersonationToken.EXPIRY_MS);
        await model.save();
        return model;
    }

    isExpired(): boolean {
        return this.expiresAt < new Date();
    }

    /**
     * Claim this ticket. Returns false when it was already used: a ticket may only ever
     * hand out one session, even when two requests arrive at the same time.
     */
    async consume(): Promise<boolean> {
        const { affectedRows } = await ImpersonationToken.delete().where('token', this.token).delete();
        return affectedRows === 1;
    }

    /**
     * Look up a ticket that is still valid, deleting it when it turns out to be expired.
     * Does not consume it: call consume() once the request is allowed to proceed.
     */
    static async getValid(token: string): Promise<ImpersonationToken | undefined> {
        if (!token) {
            return undefined;
        }
        const model = await this.select().where('token', token).first(false);
        if (!model) {
            return undefined;
        }
        if (model.isExpired()) {
            await model.delete();
            return undefined;
        }
        return model;
    }

    /**
     * Remove every expired ticket. Tickets are also dropped when they are looked up after
     * expiring, but one that is never opened would stay behind forever.
     */
    static async deleteExpired(): Promise<number> {
        const { affectedRows } = await this.delete().where('expiresAt', SQLWhereSign.Less, new Date()).delete();
        return affectedRows;
    }
}
