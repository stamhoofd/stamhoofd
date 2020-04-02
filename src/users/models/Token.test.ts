import { Database } from "../../database/classes/Database";
import { Token } from "./Token";
import { User } from "./User";

describe("Model.Token", () => {
    const existingToken = "ABCDEFG";
    let userId: number;

    beforeAll(async () => {
        const [userData] = await Database.insert("INSERT INTO " + User.table + " SET ?", [
            {
                email: "existing2@domain.com",
                password:
                    "$argon2i$v=19$m=4096,t=3,p=1$wQiDNFtEKm8mQsdqJGnhfg$V4hByYMRUA/H9DipmJRG8QOn12wa+feRhi/ocBxxc2k",
                // = "myPassword"
                createdOn: "2020-03-29 14:30:15"
            }
        ]);
        userId = userData.insertId;

        const [data] = await Database.insert("INSERT INTO " + Token.table + " SET ?", [
            {
                accessToken: existingToken,
                refreshToken: "refreshtoken",

                accessTokenValidUntil: "2050-08-29 14:30:15",
                refreshTokenValidUntil: "2050-08-29 14:30:15",
                userId: userId,
                deviceId: "my device id",
                deviceName: "my device",
                // = "myPassword"
                createdOn: "2020-03-29 14:30:15"
            }
        ]);
    });

    test("Get token", async () => {
        const token: any = await Token.getByAccessToken(existingToken);
        expect(token).toBeDefined();
        expect(token).toBeInstanceOf(Token);
        expect(token.user.id).toEqual(userId);
        expect(token.accessToken).toEqual(existingToken);
        expect(token.userId).toEqual(userId);
    });
});
