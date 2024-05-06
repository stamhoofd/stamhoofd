
import { column, Database, ManyToOneRelation, Model } from "@simonbackx/simple-database";
import { I18n } from "@stamhoofd/backend-i18n";
import basex from "base-x";
import crypto from "crypto";

import { Organization, User } from "./";
const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const bs58 = basex(ALPHABET)

export type PasswordTokenWithUser = PasswordToken & { user: User };

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

export class PasswordToken extends Model {
    static table = "password_tokens";
   
    // Columns
    @column({ primary: true, type: "string" })
    token: string;

    @column({ type: "datetime" })
    validUntil: Date;

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

    @column({ type: "string", foreignKey: PasswordToken.user })
    userId: string;

    static user = new ManyToOneRelation(User, "user");

    isExpired(): boolean {
        return this.validUntil < new Date()
    }
    
    /**
     * Get a token
     * @param token 
     * @param ignoreExpireDate: do not return if it is expired
     */
    static async getToken(token: string, ignoreExpireDate = false): Promise<PasswordTokenWithUser | undefined> {
        const [rows] = await Database.select(
            `SELECT ${this.getDefaultSelect()}, ${User.getDefaultSelect("user")}  FROM ${
                this.table
            } ${PasswordToken.user.joinQuery(this.table, "user")} WHERE ${this.primary.name} = ? LIMIT 1 `,
            [token]
        );

        if (rows.length == 0) {
            return undefined;
        }

        const passwordToken = this.fromRow(rows[0][this.table]);

        if (!passwordToken) {
            return undefined;
        }

        if (!ignoreExpireDate && passwordToken.isExpired()) {
            // If the refresh token is invalid, do not return it
            return undefined
        }

        const user = User.fromRow(rows[0]["user"]) || null;

        if (!user) {
            console.error("Password token without a valid user!");
            return undefined;
        }

        return passwordToken.setRelation(PasswordToken.user, user);
    }

    /***
     * Create a token without saving it
     */
    static async createToken<U extends User>(user: U, validUntil?: Date): Promise<PasswordTokenWithUser> {
        const token = new PasswordToken().setRelation(PasswordToken.user, user);

        if (validUntil) {
            token.validUntil = new Date(validUntil)
        } else {
            token.validUntil = new Date();
            token.validUntil.setTime(token.validUntil.getTime() + 3 * 3600 * 1000);
        }
        token.validUntil.setMilliseconds(0);
        token.token = bs58.encode(await randomBytes(100)).toLowerCase();
        await token.save();
        return token;
    }

    static async getPasswordRecoveryUrl(user: User, organization: Organization|null, i18n: I18n, validUntil?: Date) {
        if ((user.organizationId ?? null) !== (organization?.id ?? null)) {
            throw new Error('Unexpected mismatch in organization id for PasswordToken')
        }
        // Send an e-mail to say you already have an account + follow password forgot flow
        const token = await PasswordToken.createToken(user, validUntil)

        let host: string;
        if (user.permissions || !organization) {
            host = "https://"+(STAMHOOFD.domains.dashboard ?? "stamhoofd.app")+"/"+i18n.locale
        } else {
            host = "https://"+organization.getHost()

            if (i18n.language != organization.i18n.language) {
                host += "/"+i18n.language
            }
        }

        return host+"/reset-password"+(user.permissions && user.organizationId ? "/"+encodeURIComponent(user.organizationId) : "")+"?token="+encodeURIComponent(token.token);
    }

    static async getMagicSignInUrl(user: User, organization: Organization) {
        // For now we don't add a token yet for security. We might add some sort of email validation thing later on
        const host = "https://"+organization.getHost()
        return Promise.resolve(host+"/login"+"?email="+encodeURIComponent(user.email)+"&hasAccount="+(user.hasAccount() ? 1 : 0));
    }

    static async clearFor(userId: string) {
        const query = `DELETE from ${this.table} where userId = ?`;
        await Database.delete(query, [userId])
    }
}
