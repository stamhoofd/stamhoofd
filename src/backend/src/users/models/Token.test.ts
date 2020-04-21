import { Database } from "@stamhoofd/backend/src/database/classes/Database";
import { Token } from "./Token";
import { User, UserWithOrganization } from "./User";
import { Organization } from "@stamhoofd/backend/src/organizations/models/Organization";
import { OrganizationFactory } from "@stamhoofd/backend/src/organizations/factories/OrganizationFactory";
import { UserFactory } from "../factories/UserFactory";

describe("Model.Token", () => {
    const existingToken = "ABCDEFG";
    let user: UserWithOrganization;
    let organization: Organization;

    beforeAll(async () => {
        organization = await new OrganizationFactory({}).create();
        user = await new UserFactory({ organization }).create();

        await Database.insert("INSERT INTO " + Token.table + " SET ?", [
            {
                accessToken: existingToken,
                refreshToken: "refreshtoken",

                accessTokenValidUntil: "2050-08-29 14:30:15",
                refreshTokenValidUntil: "2050-08-29 14:30:15",
                userId: user.id,
                // = "myPassword"
                createdOn: "2020-03-29 14:30:15",
            },
        ]);
    });

    test("Get token", async () => {
        const token: any = await Token.getByAccessToken(existingToken);
        expect(token).toBeDefined();
        expect(token).toBeInstanceOf(Token);
        expect(token.user.id).toEqual(user.id);
        expect(token.accessToken).toEqual(existingToken);
        expect(token.userId).toEqual(user.id);
    });

    test("Create a token", async () => {
        const cleanUser = user.unloadRelation(User.organization);
        const token = await Token.createToken(cleanUser);
        expect(token).toBeDefined();
        if (!token) return;
        expect(token).toBeInstanceOf(Token);
        expect(token.user.id).toEqual(user.id);
        expect(token.accessToken).toHaveLength(256);
        expect(token.refreshToken).toHaveLength(256);
        expect(token.accessTokenValidUntil.getTime()).toBeGreaterThan(new Date().getTime() + (3600 * 1000) / 2 - 1);
        expect(token.accessTokenValidUntil.getTime()).toBeLessThan(new Date().getTime() + 3600 * 1000 * 24 * 365);

        expect(token.refreshTokenValidUntil.getTime()).toBeGreaterThan(token.accessTokenValidUntil.getTime());
        expect(token.refreshTokenValidUntil.getTime()).toBeLessThan(new Date().getTime() + 3600 * 1000 * 24 * 365);

        expect(token.userId).toEqual(user.id);

        const search: any = await Token.getByAccessToken(token.accessToken);
        // Make sure we do not compare the organization, since that won't be loaded now, but is loaded on user, and on token

        expect(search).toEqual(token);
    });
});
