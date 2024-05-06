import { column, Database, ManyToOneRelation, Model } from "@simonbackx/simple-database";
import { ApiUser } from "@stamhoofd/structures";
import crypto from "crypto";

import { RateLimiter } from "../helpers/RateLimiter";
import { User } from './';

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

export const apiUserRateLimiter = new RateLimiter({
    limits: [
        {   
            // Block heavy bursts (5req/s for 5s)
            limit: 25,
            duration: 5 * 1000
        },
        {   
            // max 1req/s during 150s
            limit: 150,
            duration: 150 * 1000
        },
        {   
            // 1000 requests per hour
            limit: 1000,
            duration: 60 * 1000 * 60
        },
        {   
            // 2000 requests per day
            limit: 2000,
            duration: 24 * 60 * 1000 * 60
        }
    ]
});

export class Token extends Model {
    static table = "tokens";
    static MAX_DEVICES = 15;

    @column({ type: "string", foreignKey: Token.user })
    userId: string;

    // Columns
    @column({ primary: true, type: "string" })
    accessToken: string;

    @column({ type: "string" })
    refreshToken: string;

    @column({ type: "datetime" })
    accessTokenValidUntil: Date;

    @column({ type: "datetime" })
    refreshTokenValidUntil: Date;

    @column({
        type: "datetime", beforeSave(old?: any) {
            if (old !== undefined) {
                return old;
            }
            const date = new Date()
            date.setMilliseconds(0)
            return date
        }
    })
    createdAt: Date

    @column({
        type: "datetime", beforeSave() {
            const date = new Date()
            date.setMilliseconds(0)
            return date
        },
        skipUpdate: true
    })
    updatedAt: Date

    static user = new ManyToOneRelation(User, "user");

    isAccessTokenExpired(): boolean {
        return this.accessTokenValidUntil < new Date() || this.refreshTokenValidUntil < new Date()
    }

    static async getAPIUserWithToken(user: User) {
        if (!user.isApiUser) {
            throw new Error('Unexpected user type')
        }

        const [lastToken] = await this.where({
            userId: user.id
        }, {limit: 1})

        return ApiUser.create({
            id: user.id,
            organizationId: user.organizationId,
            name: user.name,
            permissions: user.permissions,
            expiresAt: lastToken?.accessTokenValidUntil ?? null,
            createdAt: user.createdAt,
        })
    }

    /**
     * Get the token and user for a given accessToken IF it is still valid
     */
    static async getByAccessToken(accessToken: string, ignoreExpireDate = false): Promise<TokenWithUser | undefined> {
        const [rows] = await Database.select(
            `SELECT ${this.getDefaultSelect()}, user.*  FROM ${
                this.table
            } ${Token.user.joinQuery(this.table, "user")} WHERE ${this.primary.name} = ? LIMIT 1 `,
            [accessToken]
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
            return undefined
        }

        const user = User.fromRow(rows[0]["user"]) || null;

        if (!user) {
            console.warn("Selected a token without a user!");
            return undefined;
        }

        return token.setRelation(Token.user, user);
    }

    // Methods
    static async getByRefreshToken(refreshToken: string): Promise<TokenWithUser | undefined> {
        const [rows] = await Database.select(
            `SELECT ${this.getDefaultSelect()}, ${User.getDefaultSelect("user")}  FROM ${
            this.table
            } ${Token.user.joinQuery(this.table, "user")} WHERE \`refreshToken\` = ? LIMIT 1 `,
            [refreshToken]
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
            // Refreh token invalid = can throw it away
            token.delete().catch(e => {
                console.error(e)
            })
            return undefined
        }

        const user = User.fromRow(rows[0]["user"]) || null;

        if (!user || user.isApiUser) {
            console.warn("Selected a token without a user!");
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
        token.accessTokenValidUntil = new Date(Date.now() - 24 * 60 * 60 * 1000 * 31 );
        token.accessTokenValidUntil.setMilliseconds(0);

        await token.save();
        return token;
    }

    /***
     * Create a token without saving it
     */
    static async createUnsavedToken<U extends User>(user: U): Promise<(Token & { user: U })> {
        // Get all the tokens of the user that are olde

        // First search if we already have more than 5 tokens (we only allow up to 5 devices)
        // In case we already have a token for that deviceId, we'll delete it first.
        try {
            const [
                rows,
            ] = await Database.delete(
                `DELETE FROM \`${this.table}\` WHERE ${this.primary.name} IN (SELECT ${this.primary.name} FROM (SELECT ${this.primary.name} FROM \`${this.table}\` WHERE \`userId\` = ? ORDER BY\`refreshTokenValidUntil\` DESC LIMIT ? OFFSET ?) x)`,
                [user.id, this.MAX_DEVICES, this.MAX_DEVICES]
            );

            if (rows.affectedRows > 0) {
                console.log(`Deleted ${rows.affectedRows} old tokens first`);
            }
        } catch (e) {
            // This is not a crucial operation, so don't fail when there is a deadlock problem in the query
            console.error(e)
        }
        
        const token = new Token().setRelation(Token.user, user);
        token.accessTokenValidUntil = new Date();
        token.accessTokenValidUntil.setTime(token.accessTokenValidUntil.getTime() + 3600 * 1000);
        token.accessTokenValidUntil.setMilliseconds(0);

        token.refreshTokenValidUntil = new Date();
        token.refreshTokenValidUntil.setTime(token.refreshTokenValidUntil.getTime() + 3600 * 1000 * 24 * 365);
        token.refreshTokenValidUntil.setMilliseconds(0);

        token.accessToken = (await randomBytes(192)).toString("base64").toUpperCase();
        token.refreshToken = (await randomBytes(192)).toString("base64").toUpperCase();
        return token;
    }

    static async createToken<U extends User>(user: U): Promise<(Token & { user: U })> {
        const token = await this.createUnsavedToken(user);
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
        await Database.delete(query, [userId, currentToken])
    }
}
