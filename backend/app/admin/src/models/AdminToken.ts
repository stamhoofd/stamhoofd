import { column, Database, ManyToOneRelation,Model } from "@simonbackx/simple-database";
import { DecodedRequest } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import crypto from "crypto";

import { Admin } from "./Admin";

export type AdminTokenWithAdmin = AdminToken & { admin: Admin };

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

export class AdminToken extends Model {
    static table = "admin_tokens";
    static MAX_DEVICES = 5;
    static ACCESS_TOKEN_VALID_MS = 60 * 15 * 1000; // 15 minutes
    static REFRESH_TOKEN_VALID_MS = 60 * 60 * 1000 * 24; // 1 day

    @column({ type: "string", foreignKey: AdminToken.admin })
    adminId: string;

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

    static admin = new ManyToOneRelation(Admin, "admin");

    static async optionalAuthenticate(request: DecodedRequest<any, any, any>): Promise<Admin | undefined> {
        const header = request.headers.authorization
        if (!header) {
            return
        }
        return this.authenticate(request)
    }

    /**
     * Throws instead of returning undefined
     */
    static async authenticate(request: DecodedRequest<any, any, any>): Promise<Admin> {
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
        if (!token) {
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

        return token.admin
    }

    isAccessTokenExpired(): boolean {
        return this.accessTokenValidUntil < new Date() || this.refreshTokenValidUntil < new Date()
    }

    /**
     * Get the token and admin for a given accessToken IF it is still valid
     */
    static async getByAccessToken(accessToken: string, ignoreExpireDate = false): Promise<AdminTokenWithAdmin | undefined> {
        const [rows] = await Database.select(
            `SELECT ${this.getDefaultSelect()}, ${Admin.getDefaultSelect("admin")}  FROM ${
                this.table
            } ${AdminToken.admin.joinQuery(this.table, "admin")} WHERE ${this.primary.name} = ? LIMIT 1 `,
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

        const admin = Admin.fromRow(rows[0]["admin"]) || null;

        if (!admin) {
            console.warn("Selected a token without a admin!");
            return undefined;
        }

        return token.setRelation(AdminToken.admin, admin);
    }

    // Methods
    static async getByRefreshToken(refreshToken: string): Promise<AdminTokenWithAdmin | undefined> {
        const [rows] = await Database.select(
            `SELECT ${this.getDefaultSelect()}, ${Admin.getDefaultSelect("admin")}  FROM ${
            this.table
            } ${AdminToken.admin.joinQuery(this.table, "admin")} WHERE \`refreshToken\` = ? LIMIT 1 `,
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

        const admin = Admin.fromRow(rows[0]["admin"]) || null;

        if (!admin) {
            console.warn("Selected a token without a admin!");
            return undefined;
        }

        return token.setRelation(AdminToken.admin, admin);
    }

    /**
     * Create a token that is expired. This can be usefull if renewing the token is restricted by some account state.
     * E.g. you cannot renew this token until the e-mail address has been verified.
     * @param admin 
     */
    static async createExpiredToken<U extends Admin>(admin: U): Promise<(AdminToken & { admin: U })> {
        const token = await this.createUnsavedToken(admin);

        /// Expired a month ago (to prevent any timezone bugs)
        token.accessTokenValidUntil = new Date(Date.now() - 24 * 60 * 60 * 1000 * 31 );
        token.accessTokenValidUntil.setMilliseconds(0);

        await token.save();
        return token;
    }

    /***
     * Create a token without saving it
     */
    static async createUnsavedToken<U extends Admin>(admin: U): Promise<(AdminToken & { admin: U })> {
        // Get all the tokens of the admin that are olde

        // First search if we already have more than 5 tokens (we only allow up to 5 devices)
        // In case we already have a token for that deviceId, we'll delete it first.
        try {
            const [
                rows,
            ] = await Database.delete(
                `DELETE FROM \`${this.table}\` WHERE ${this.primary.name} IN (SELECT ${this.primary.name} FROM (SELECT ${this.primary.name} FROM \`${this.table}\` WHERE \`adminId\` = ? ORDER BY\`refreshTokenValidUntil\` DESC LIMIT ? OFFSET ?) x)`,
                [admin.id, this.MAX_DEVICES, this.MAX_DEVICES]
            );

            if (rows.affectedRows > 0) {
                console.log(`Deleted ${rows.affectedRows} old tokens first`);
            }
        } catch (e) {
            // This is not a crucial operation, so don't fail when there is a deadlock problem in the query
            console.error(e)
        }
        
        const token = new AdminToken().setRelation(AdminToken.admin, admin);
        token.accessTokenValidUntil = new Date();
        token.accessTokenValidUntil.setTime(token.accessTokenValidUntil.getTime() + this.ACCESS_TOKEN_VALID_MS);
        token.accessTokenValidUntil.setMilliseconds(0);

        token.refreshTokenValidUntil = new Date();
        token.refreshTokenValidUntil.setTime(token.refreshTokenValidUntil.getTime() + this.REFRESH_TOKEN_VALID_MS);
        token.refreshTokenValidUntil.setMilliseconds(0);

        token.accessToken = (await randomBytes(192)).toString("base64").toUpperCase();
        token.refreshToken = (await randomBytes(192)).toString("base64").toUpperCase();
        return token;
    }

    static async createToken<U extends Admin>(admin: U): Promise<(AdminToken & { admin: U })> {
        const token = await this.createUnsavedToken(admin);
        await token.save();
        return token;
    }
}
