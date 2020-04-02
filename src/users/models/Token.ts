import { Model } from "../../database/classes/Model";
import { column } from "../../database/decorators/Column";
import { ManyToOneRelation } from "../../database/classes/ManyToOneRelation";
import { User } from "./User";
import { Database } from "../../database/classes/Database";
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
    static table = "user_tokens";

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

    @column({ type: "string" })
    deviceId: string;

    @column({ type: "string" })
    deviceName: string;

    @column({ type: "integer", foreignKey: Token.user })
    userId: number;

    static user = new ManyToOneRelation(User, "user");

    // Methods
    static async getByAccessToken(accessToken: string): Promise<TokenWithUser | undefined> {
        const [rows] = await Database.select(
            `SELECT ${this.getDefaultSelect()}, ${User.getDefaultSelect("user")}  FROM ${
                this.table
            } ${Token.user.joinQuery(this.table, "user")} WHERE ${this.primaryKey} = ? LIMIT 1 `,
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

    static async createToken(user: User, deviceId: string, deviceName: string): Promise<TokenWithUser | undefined> {
        // Todo: start a transaction here

        // First search if we already have a token for this deviceId.
        // In case we already have a token for that deviceId, we'll delete it first.
        const [rows] = await Database.delete(`DELETE FROM ${this.table} WHERE \`userId\` = ? AND \`deviceId\` = ?`, [
            user.id,
            deviceId
        ]);

        if (rows.affectedRows > 0) {
            console.log(`Deleted ${rows.affectedRows} old tokens first`);
        }

        const token = new Token().setRelation(Token.user, user);
        token.deviceId = deviceId;
        token.deviceName = deviceName;
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
