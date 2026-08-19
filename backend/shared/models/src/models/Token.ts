import type { ManyToOneRelation } from '@simonbackx/simple-database';
import { column, Database } from '@simonbackx/simple-database';
import { QueryableModel, SQLWhereSign } from '@stamhoofd/sql';
import { ApiUser, SessionClientType, SessionLoginMethod } from '@stamhoofd/structures';
import crypto from 'crypto';

import { SimpleError } from '@simonbackx/simple-errors';
import { ACCESS_TOKEN_DURATION, DEFAULT_REFRESH_TOKEN_DURATION } from '../constants/sessions.js';
import { User } from './User.js';

export type TokenWithUser = Token & { user: User };

async function randomBytes(size: number): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        crypto.randomBytes(size, (err: Error | null, buf: Buffer) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(buf);
        });
    });
}

export class Token extends QueryableModel {
    static table = 'tokens';
    static MAX_DEVICES = 15;

    /**
     * How long after authentication a token still counts as "fresh" for sensitive
     * actions (e.g. managing 2FA methods).
     */
    static FRESH_WINDOW = 10 * 60 * 1000;

    @column({ type: 'string' })
    userId: string;

    // Columns
    @column({ primary: true, type: 'string' })
    accessToken: string;

    @column({ type: 'string' })
    refreshToken: string;

    @column({ type: 'datetime' })
    accessTokenValidUntil: Date;

    @column({ type: 'datetime' })
    refreshTokenValidUntil: Date;

    /**
     * When set, this token was minted by a real authentication (password, mfa, passkey,
     * password_token) at this time. Tokens created by a refresh_token rotation leave this
     * NULL. Used by Context.authenticateFresh() to gate sensitive actions (2FA management).
     */
    @column({ type: 'datetime', nullable: true })
    authenticatedAt: Date | null = null;

    /**
     * When the session this token belongs to was first authenticated. A refresh token
     * rotation creates a new token but continues the same session, so this is copied over
     * and is what the absolute session length is measured from.
     */
    @column({ type: 'datetime' })
    sessionStartedAt: Date;

    @column({ type: 'string' })
    clientType = SessionClientType.Browser;

    @column({ type: 'string' })
    loginMethod = SessionLoginMethod.Password;

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

    static user: ManyToOneRelation<'user', User>;

    isAccessTokenExpired(): boolean {
        return this.accessTokenValidUntil < new Date() || this.refreshTokenValidUntil < new Date();
    }

    /**
     * A token is fresh if it was minted by a real authentication (not a refresh) within
     * the FRESH_WINDOW. Sensitive endpoints require a fresh token.
     */
    isFresh(): boolean {
        return this.authenticatedAt !== null && this.authenticatedAt.getTime() > Date.now() - Token.FRESH_WINDOW;
    }

    /**
     * Sign out every session of a user, except the one the request was made with.
     *
     * Used after a security-relevant change to the account (enrolling or removing a
     * two-factor method): sessions that were created before that change should not
     * survive it. API users are excluded — their tokens are machine credentials that are
     * managed separately, not browser sessions.
     */
    static async deleteOtherSessions(userId: string, keepAccessToken: string | null): Promise<number> {
        const user = await User.getByID(userId);
        if (user?.isApiUser) {
            return 0;
        }

        const query = this.delete().where('userId', userId);
        if (keepAccessToken) {
            query.where(this.primary.name, SQLWhereSign.NotEqual, keepAccessToken);
        }
        const { affectedRows } = await query.delete();
        return affectedRows;
    }

    /**
     * Sign out every session of the given users, except the one the request was made with.
     *
     * Used when an administrator forces all admins to sign in again, e.g. right after
     * making two-factor authentication required. Unlike deleteOtherSessions() the caller
     * is responsible for leaving out API users, because it already has the list of users
     * it wants to sign out.
     */
    static async deleteForUsers(userIds: string[], keepAccessToken: string | null): Promise<number> {
        if (userIds.length === 0) {
            return 0;
        }

        const query = this.delete().where('userId', userIds);
        if (keepAccessToken) {
            query.where(this.primary.name, SQLWhereSign.NotEqual, keepAccessToken);
        }
        const { affectedRows } = await query.delete();
        return affectedRows;
    }

    static async getAPIUserWithToken(user: User) {
        if (!user.isApiUser) {
            throw new Error('Unexpected user type');
        }

        const [lastToken] = await this.where({
            userId: user.id,
        }, { limit: 1 });

        return ApiUser.create({
            id: user.id,
            organizationId: user.organizationId,
            name: user.name,
            permissions: user.permissions,
            expiresAt: lastToken?.accessTokenValidUntil ?? null,
            createdAt: user.createdAt,
            meta: user.meta,
        });
    }

    /**
     * Get the token and user for a given accessToken IF it is still valid
     */
    static async getByAccessToken(accessToken: string, ignoreExpireDate = false): Promise<TokenWithUser | undefined> {
        const [rows] = await Database.select(
            `SELECT ${this.getDefaultSelect()}, user.*  FROM ${
                this.table
            } ${Token.user.joinQuery(this.table, 'user')} WHERE ${this.primary.name} = ? LIMIT 1 `,
            [accessToken],
        );

        if (rows.length == 0) {
            return undefined;
        }

        // Read member + address from first row
        const token = this.fromRow(rows[0][this.table]);

        if (!token) {
            return undefined;
        }

        if (!ignoreExpireDate && (token.accessTokenValidUntil < new Date() || token.refreshTokenValidUntil < new Date())) {
            // Also if the refresh token is invalid, the access token will always be invalid
            return undefined;
        }

        const user = User.fromRow(rows[0]['user']) || null;

        if (!user) {
            console.warn('Selected a token without a user!');
            return undefined;
        }

        return token.setRelation(Token.user, user);
    }

    // Methods
    static async getByRefreshToken(refreshToken: string): Promise<TokenWithUser | undefined> {
        const [rows] = await Database.select(
            `SELECT ${this.getDefaultSelect()}, ${User.getDefaultSelect('user')}  FROM ${
                this.table
            } ${Token.user.joinQuery(this.table, 'user')} WHERE \`refreshToken\` = ? LIMIT 1 `,
            [refreshToken],
        );

        if (rows.length == 0) {
            return undefined;
        }

        // Read member + address from first row
        const token = this.fromRow(rows[0][this.table]);

        if (!token) {
            return undefined;
        }

        if (token.refreshTokenValidUntil < new Date()) {
            // If a user tries to use a refresh token that is expired - there is a possibility of a user
            // being compromised.
            // So we delete all tokens for this user.
            console.error('Detected an expired refresh token, deleting all tokens for user', token.userId);
            await this.delete().where('userId', token.userId);
            return undefined;
        }

        const user = User.fromRow(rows[0]['user']) || null;

        if (!user || user.isApiUser) {
            console.warn('Selected a token without a user!');
            return undefined;
        }

        return token.setRelation(Token.user, user);
    }

    /**
     * Create a token that is expired. This can be usefull if renewing the token is restricted by some account state.
     * E.g. you cannot renew this token until the e-mail address has been verified.
     * @param user
     */
    static async createExpiredToken<U extends User>(user: U): Promise<(Token & { user: U })> {
        const token = await this.createUnsavedToken(user);

        /// Expired a month ago (to prevent any timezone bugs)
        token.accessTokenValidUntil = new Date(Date.now() - 24 * 60 * 60 * 1000 * 31);
        token.accessTokenValidUntil.setMilliseconds(0);

        await token.save();
        return token;
    }

    /***
     * Create a token without saving it
     */
    static async createUnsavedToken<U extends User>(user: U): Promise<(Token & { user: U })> {
        if (user.isSystemUser) {
            throw new SimpleError({
                code: 'internal_error',
                message: 'Cannot create token for system user',
                statusCode: 500,
            });
        }
        // Get all the tokens of the user that are olde

        // First search if we already have more than 5 tokens (we only allow up to 5 devices)
        // In case we already have a token for that deviceId, we'll delete it first.
        try {
            const [
                rows,
            ] = await Database.delete(
                `DELETE FROM \`${this.table}\` WHERE ${this.primary.name} IN (SELECT ${this.primary.name} FROM (SELECT ${this.primary.name} FROM \`${this.table}\` WHERE \`userId\` = ? ORDER BY\`createdAt\` DESC LIMIT ? OFFSET ?) x)`,
                [user.id, this.MAX_DEVICES, this.MAX_DEVICES],
            );

            if (rows.affectedRows > 0) {
                console.log(`Deleted ${rows.affectedRows} old tokens first`);
            }
        }
        catch (e) {
            // This is not a crucial operation, so don't fail when there is a deadlock problem in the query
            console.error(e);
        }

        const token = new Token().setRelation(Token.user, user);
        token.sessionStartedAt = new Date();
        token.sessionStartedAt.setMilliseconds(0);

        token.accessTokenValidUntil = new Date();
        token.accessTokenValidUntil.setTime(token.accessTokenValidUntil.getTime() + ACCESS_TOKEN_DURATION);
        token.accessTokenValidUntil.setMilliseconds(0);

        token.refreshTokenValidUntil = new Date();
        token.refreshTokenValidUntil.setTime(token.refreshTokenValidUntil.getTime() + DEFAULT_REFRESH_TOKEN_DURATION);
        token.refreshTokenValidUntil.setMilliseconds(0);

        token.accessToken = (await randomBytes(192)).toString('base64').toUpperCase();
        token.refreshToken = (await randomBytes(192)).toString('base64').toUpperCase();
        return token;
    }

    /**
     * Create a session without any of the length limits that apply to a real login: use
     * SessionService in the api package for those.
     *
     * @param authenticatedAt Pass the current date when this token is minted by a real
     * authentication (password/mfa/passkey/password_token) so it counts as "fresh".
     * Leave null (default) for refresh_token rotations.
     */
    static async createToken<U extends User>(user: U, authenticatedAt: Date | null = null): Promise<(Token & { user: U })> {
        const token = await this.createUnsavedToken(user);
        token.authenticatedAt = authenticatedAt;
        await token.save();
        return token;
    }

    static async createApiToken<U extends User>(user: U): Promise<(Token & { user: U })> {
        const token = await this.createUnsavedToken(user);

        // 5 year valid
        token.accessTokenValidUntil = new Date();
        token.accessTokenValidUntil.setTime(token.accessTokenValidUntil.getTime() + 1000 * 60 * 60 * 24 * 365 * 5);
        token.accessTokenValidUntil.setMilliseconds(0);

        token.refreshTokenValidUntil = new Date();
        token.refreshTokenValidUntil.setTime(token.accessTokenValidUntil.getTime());
        token.refreshTokenValidUntil.setMilliseconds(0);

        await token.save();
        return token;
    }

    static async clearFor(userId: string, currentToken: string) {
        const query = `DELETE from ${this.table} where userId = ? AND accessToken != ?`;
        await Database.delete(query, [userId, currentToken]);
    }
}
