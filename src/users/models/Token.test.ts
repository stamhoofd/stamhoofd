import { Database } from "@/database/classes/Database";
import { Token } from "./Token";
import { User } from "./User";
import { Organization } from '@/organizations/models/Organization';
import { OrganizationMetaStruct, OrganizationType } from '@/organizations/structs/OrganizationMetaStruct';

describe("Model.Token", () => {
    const existingToken = "ABCDEFG";
    let userId: number;
    let organization: Organization;

    beforeAll(async () => {
        organization = new Organization()
        organization.name = "Token test organization"
        organization.uri = "token-test-organization"
        organization.createdOn = new Date();
        organization.website = "https://website.com";
        organization.meta = new OrganizationMetaStruct()
        organization.meta.type = OrganizationType.Other
        await organization.save();

        const [userData] = await Database.insert("INSERT INTO " + User.table + " SET ?", [
            {
                organizationId: organization.id,
                email: "existing2@domain.com",
                password:
                    "$argon2i$v=19$m=4096,t=3,p=1$wQiDNFtEKm8mQsdqJGnhfg$V4hByYMRUA/H9DipmJRG8QOn12wa+feRhi/ocBxxc2k",
                // = "myPassword"
                createdOn: "2020-03-29 14:30:15"
            }
        ]);
        userId = userData.insertId;

        await Database.insert("INSERT INTO " + Token.table + " SET ?", [
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

    test("Create a token", async () => {
        const user = await User.register(organization, "test-create-token@domain.com", "my password");
        expect(user).toBeDefined();
        if (!user) return;

        // We don't need the organization anymore, since fetching a token won't contain an organization, and we'll need to compare with it
        user.unloadRelation(User.organization)

        const token = await Token.createToken(user, "My device id", "My device name");
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
        expect(search).toEqual(token);
    });
});
