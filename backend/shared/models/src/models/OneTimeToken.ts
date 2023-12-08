
import { column, Model } from "@simonbackx/simple-database";
import { AnyDecoder } from "@simonbackx/simple-encoding";
import basex from "base-x";
import crypto from "crypto";

import { Organization } from "./Organization";

const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const bs58 = basex(ALPHABET)

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

enum OneTimeTokenType {
    WebshopNotificationEmailVerification = "WebshopNotificationEmailVerification",
    WebshopNotificationEmailUnsubscribe = "WebshopNotificationEmailUnsubscribe"
}

/**
 * Token that saves some information and can execute an action if you have access to the token (e.g. in an email)
 */
export class OneTimeToken extends Model {
    static table = "one_time_tokens";
   
    // Columns
    @column({ primary: true, type: "string" })
    token: string;

    @column({ type: "string" })
    organizationId: string;

    @column({ type: "datetime", nullable: true })
    validUntil: Date | null = null;

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

    // Columns
    @column({ type: "string" })
    type: OneTimeTokenType

    // Columns
    @column({ type: "json", decoder: AnyDecoder })
    data: any = {};

    isExpired(): boolean {
        return !!this.validUntil && this.validUntil < new Date()
    }
    
    /**
     * Get a token
     * @param token 
     * @param ignoreExpireDate: do not return if it is expired
     */
    static async getToken(token: string, organizationId: string, ignoreExpireDate = false): Promise<OneTimeToken | undefined> {
        const [oneTimeToken] = await this.where({token, organizationId}, {limit: 1})

        if (!oneTimeToken) {
            return undefined;
        }

        if (!ignoreExpireDate && oneTimeToken.isExpired()) {
            // If the refresh token is invalid, do not return it
            return undefined
        }

        return oneTimeToken;
    }

    /***
     * Create a token without saving it
     */
    static async createToken(organizationId: string, type: OneTimeTokenType, data: any, options?: {validUntil?: Date, expireIn?: number}): Promise<OneTimeToken> {
        const token = new OneTimeToken();
        token.type = type;
        token.data = data;
        token.organizationId = organizationId

        if (options?.validUntil) {
            token.validUntil = new Date(options?.validUntil)
            token.validUntil.setMilliseconds(0);
        } else if (options?.expireIn) {
            token.validUntil = new Date();
            token.validUntil.setTime(token.validUntil.getTime() + options?.expireIn);
            token.validUntil.setMilliseconds(0);
        }
        token.token = bs58.encode(await randomBytes(100)).toLowerCase();
        await token.save();
        return token;
    }

    /**
     * Pass in an organization if you want to use the registration page instead of the dashboard
     */
    getUrl(organization: Organization, dashboard = false) {
        // Send an e-mail to say you already have an account + follow password forgot flow
        const i18n = organization.i18n;

        let host: string;
        if (dashboard) {
            host = "https://"+(STAMHOOFD.domains.dashboard ?? "stamhoofd.app")+"/"+i18n.locale
        } else {
            host = "https://"+organization.getHost()

            if (i18n.language != organization.i18n.language) {
                host += "/"+i18n.language
            }
        }

        return host+"/ott"+(dashboard ? "/"+encodeURIComponent(organization.id) : "")+"?token="+encodeURIComponent(this.token);
    }
}
