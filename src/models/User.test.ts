import { Database } from "@simonbackx/simple-database";

import { OrganizationFactory } from "../factories/OrganizationFactory";
import { UserFactory } from '../factories/UserFactory';
import { Organization } from "../models/Organization";
import { User } from "./User";

describe("Model.User", () => {
    let existingUserId: string;
    let organization: Organization;

    beforeAll(async () => {
        organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({
            email: "existing@domain.com",
            password: "myPassword",
            verified: true,
            organization: organization
        }).create();
        
        existingUserId = user.id
    });

    test("Get user by id", async () => {
        const user: any = await User.getByID(existingUserId);
        expect(user).toBeDefined();
        expect(user).toBeInstanceOf(User);
        expect(user.password).toBeUndefined();
        expect(user.savedProperties.get("password")).toBeUndefined();
        expect(user.id).toEqual(existingUserId)
    });

    test("Create a user", async () => {
        const user: any = await User.register(organization, "test@domain.com", "myPassword", "public key");
        expect(user).toBeDefined();
        expect(user).toBeInstanceOf(User);
        expect(user.password).toBeUndefined();
        expect(user.savedProperties.get("password")).toBeUndefined();
        expect(user.id).not.toBeEmpty()
    });

    test("Create a user with an email that already exists", async () => {
        const user: any = await User.register(organization, "existing@domain.com", "otherPassword123", "my public key");
        expect(user).toBeUndefined();
    });

    test("Login a user", async () => {
        const user: any = await User.login(organization, "existing@domain.com", "myPassword");
        expect(user).toBeInstanceOf(User);
        expect(user.password).toBeUndefined();
        expect(user.savedProperties.get("password")).toBeUndefined();
        expect(user.id).not.toBeEmpty()
    });

    test("Providing a wrong password fails login", async () => {
        const user: any = await User.login(organization, "existing@domain.com", "myPassword2");
        expect(user).toBeUndefined();
    });

    test("Providing a wrong email fails login", async () => {
        const user: any = await User.login(organization, "not-existing@domain.com", "myPassword");
        expect(user).toBeUndefined();
    });
});
