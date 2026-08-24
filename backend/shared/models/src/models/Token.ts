import type { ManyToOneRelation } from '@simonbackx/simple-database';
import { column, Database } from '@simonbackx/simple-database';
import { QueryableModel } from '@stamhoofd/sql';
import { ApiUser } from '@stamhoofd/structures';

import { User } from './User.js';
import { UserSession } from './UserSession.js';

export type TokenWithUser = Token & { user: User };
export type TokenWithSession = Token & { user: User; session: UserSession };

export class Token extends QueryableModel {
    static table = 'tokens';

    /**
     * How long after authentication a token still counts as "fresh" for sensitive
     * actions (e.g. managing 2FA methods).
     */
    static FRESH_WINDOW = 10 * 60 * 1000;

    @column({ type: 'string' })
    id: string;

    @column({ type: 'string' })
    userId: string;

    @column({ type: 'string' })
    sessionId: string;

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
    static session: ManyToOneRelation<'session', UserSession>;

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
    static async getByAccessToken(accessToken: string, ignoreExpireDate = false): Promise<TokenWithSession | undefined> {
        const [rows] = await Database.select(
            `SELECT ${this.getDefaultSelect()}, ${User.getDefaultSelect('user')}, ${UserSession.getDefaultSelect('session')} FROM ${
                this.table
            } ${Token.user.joinQuery(this.table, 'user')} ${Token.session.joinQuery(this.table, 'session')} WHERE ${this.primary.name} = ? LIMIT 1 `,
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

        const session = UserSession.fromRow(rows[0]['session']) || null;

        if (!session) {
            console.warn('Selected a token without a session!');
            return undefined;
        }

        return token.setRelation(Token.user, user).setRelation(Token.session, session);
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

        const user = User.fromRow(rows[0]['user']) || null;

        if (!user) {
            console.warn('Selected a token without a user!');
            return undefined;
        }

        return token.setRelation(Token.user, user);
    }

}
