import { Model } from "@stamhoofd-backend/database";
import { column } from "@stamhoofd-backend/database";
import { ManyToOneRelation } from "@stamhoofd-backend/database";
import { User } from "./User";
import { Database } from "@stamhoofd-backend/database";
import crypto from "crypto";

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

export class Token extends Model {
    static table = "tokens";
    static MAX_DEVICES = 5;

    // Columns
    @column({ primary: true, type: "string" })
    accessToken: string;

    @column({ type: "string" })
    refreshToken: string;

    @column({ type: "datetime" })
    accessTokenValidUntil: Date;

    @column({ type: "datetime" })
    refreshTokenValidUntil: Date;

    @column({ type: "datetime" })
    createdOn: Date;

    @column({ type: "integer", foreignKey: Token.user })
    userId: number;

    static user = new ManyToOneRelation(User, "user");

    // Methods
    static async getByAccessToken(accessToken: string): Promise<TokenWithUser | undefined> {
        const [rows] = await Database.select(
            `SELECT ${this.getDefaultSelect()}, ${User.getDefaultSelect("user")}  FROM ${
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

        const user = User.fromRow(rows[0]["user"]) || null;

        if (!user) {
            console.warn("Selected a token without a user!");
            return undefined;
        }

        return token.setRelation(Token.user, user);
    }

    static async createToken<U extends User>(user: U): Promise<(Token & { user: U }) | undefined> {
        // Get all the tokens of the user that are olde

        // First search if we already have more than 5 tokens (we only allow up to 5 devices)
        // In case we already have a token for that deviceId, we'll delete it first.
        const [
            rows,
        ] = await Database.delete(
            `DELETE FROM \`${this.table}\` WHERE ${this.primary.name} IN (SELECT ${this.primary.name} FROM (SELECT ${this.primary.name} FROM \`${this.table}\` WHERE \`userId\` = ? ORDER BY\`refreshTokenValidUntil\` DESC LIMIT ? OFFSET ?) x)`,
            [user.id, this.MAX_DEVICES, this.MAX_DEVICES]
        );

        if (rows.affectedRows > 0) {
            console.log(`Deleted ${rows.affectedRows} old tokens first`);
        }

        const token = new Token().setRelation(Token.user, user);
        token.accessTokenValidUntil = new Date();
        token.accessTokenValidUntil.setTime(token.accessTokenValidUntil.getTime() + 3600 * 1000);
        token.accessTokenValidUntil.setMilliseconds(0);

        token.refreshTokenValidUntil = new Date();
        token.refreshTokenValidUntil.setTime(token.refreshTokenValidUntil.getTime() + 3600 * 1000 * 24 * 365);
        token.refreshTokenValidUntil.setMilliseconds(0);

        token.createdOn = new Date();
        token.createdOn.setMilliseconds(0);

        token.accessToken = (await randomBytes(192)).toString("base64").toUpperCase();
        token.refreshToken = (await randomBytes(192)).toString("base64").toUpperCase();

        await token.save();
        return token;
    }
}
