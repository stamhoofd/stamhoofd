import { column, Database, ManyToOneRelation, Model } from "@simonbackx/simple-database";
import { DecodedRequest } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import crypto from "crypto";

import { RateLimiter } from "../helpers/RateLimiter";
import { Organization, User, UserWithOrganization } from './';

export type TokenWithUser = Token & { user: User };
export type TokenWithOrganizationAndUser = Token & { user: UserWithOrganization };

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

    static async optionalAuthenticate(request: DecodedRequest<any, any, any>, options?: {allowWithoutAccount: boolean}): Promise<TokenWithOrganizationAndUser | undefined> {
        const header = request.headers.authorization
        if (!header) {
            return
        }
        return this.authenticate(request, options)
    }

    /**
     * Throws instead of returning undefined
     * allowWithoutAccount: allow users who don't have a password yet to authenticate (required for users who want to set a password)
     */
    static async authenticate(request: DecodedRequest<any, any, any>, {allowWithoutAccount} = {allowWithoutAccount: false}): Promise<TokenWithOrganizationAndUser> {
        const organization = await Organization.getFromRequest(request);
        const header = request.headers.authorization
        if (!header) {
            throw new SimpleError({
                code: "not_authenticated",
                message: "Missing required authorization header",
                statusCode: 401
            })
        }

        if (!header.startsWith("Bearer ")) {
            throw new SimpleError({
                code: "not_supported_authentication",
                message: "Authentication method not supported. Please authenticate with OAuth2",
                statusCode: 401
            })
        }

        const accessToken = header.substring("Bearer ".length);

        const token = await this.getByAccessToken(accessToken, true)
        if (!token || token.user.organizationId != organization.id) {
            throw new SimpleError({
                code: "invalid_access_token",
                message: "The access token is invalid",
                human: "Je bent automatisch uitgelogd, log opnieuw in om verder te gaan",
                statusCode: 401
            })
        }
        
        if (token.isAccessTokenExpired()) {
            throw new SimpleError({
                code: "expired_access_token",
                message: "The access token is expired",
                human: "Je bent automatisch uitgelogd, log opnieuw in om verder te gaan",
                statusCode: 401
            })
        }

        if (!token.user.setRelation(User.organization, organization)) {
            throw new Error("Unexpected error when setting a relationship")
        }

        if (!token.user.hasAccount() && !allowWithoutAccount) {
            throw new SimpleError({
                code: "not_activated",
                message: "This user is not yet activated",
                human: "Maak een account aan op dit e-mailadres om een wachtwoord in te stellen voor je inlogt.",
                statusCode: 401
            })
        }

        // Rate limits for api users
        if (token.user.isApiUser) {
            apiUserRateLimiter.track(organization.id)
        }

        return token as TokenWithOrganizationAndUser
    }

    isAccessTokenExpired(): boolean {
        return this.accessTokenValidUntil < new Date() || this.refreshTokenValidUntil < new Date()
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
