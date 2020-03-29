import { User } from "./User";
import { Database } from "../../database/classes/Database";

describe("Model.User", () => {
    beforeAll(async () => {
        await Database.insert("INSERT INTO " + User.table + " SET ?", [
            {
                email: "existing@domain.com",
                password:
                    "$argon2i$v=19$m=4096,t=3,p=1$wQiDNFtEKm8mQsdqJGnhfg$V4hByYMRUA/H9DipmJRG8QOn12wa+feRhi/ocBxxc2k",
                // = "myPassword"
                createdOn: "2020-03-29 14:30:15"
            }
        ]);
    });

    test("Create a user", async () => {
        const user: any = await User.register("test@domain.com", "myPassword");
        expect(user).toBeDefined();
        expect(user).toBeInstanceOf(User);
        expect(user.password).toBeUndefined();
        expect(user.id).toBeGreaterThanOrEqual(1);
    });

    test("Create a user with an email that already exists", async () => {
        const user: any = await User.register("existing@domain.com", "otherPassword123");
        expect(user).toBeUndefined();
    });

    test("Login a user", async () => {
        const user: any = await User.login("existing@domain.com", "myPassword");
        expect(user).toBeInstanceOf(User);
        expect(user.password).toBeUndefined();
        expect(user.id).toBeGreaterThanOrEqual(1);
    });

    test("Providing a wrong password fails login", async () => {
        const user: any = await User.login("existing@domain.com", "myPassword2");
        expect(user).toBeUndefined();
    });

    test("Providing a wrong email fails login", async () => {
        const user: any = await User.login("not-existing@domain.com", "myPassword");
        expect(user).toBeUndefined();
    });
});
