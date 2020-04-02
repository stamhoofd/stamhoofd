import { Model } from "../../database/classes/Model";
import { column } from "../../database/decorators/Column";
import { ManyToOneRelation } from "../../database/classes/ManyToOneRelation";
import { User } from "./User";

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
}
