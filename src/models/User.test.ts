import { KeyConstantsHelper, SensitivityLevel,Sodium } from '@stamhoofd/crypto';
import { KeyConstants } from '@stamhoofd/structures';

import { OrganizationFactory } from "../factories/OrganizationFactory";
import { UserFactory } from '../factories/UserFactory';
import { Organization } from "../models/Organization";
import { User } from "./User";

describe("Model.User", () => {
    let existingUserId: string;
    let organization: Organization;

    // Only generate these keys once, because they are quite expensive
    let userKeyPair: { publicKey: string; privateKey: string };
    let authSignKeyConstants: KeyConstants
    let authEncryptionKeyConstants: KeyConstants
    let authSignKeyPair: { publicKey: string; privateKey: string };
    let authEncryptionSecretKey: string

    beforeAll(async () => {
        userKeyPair = await Sodium.generateEncryptionKeyPair();
        authSignKeyConstants = await KeyConstantsHelper.create(SensitivityLevel.Tests)
        authEncryptionKeyConstants = await KeyConstantsHelper.create(SensitivityLevel.Tests)
        authSignKeyPair = await KeyConstantsHelper.getSignKeyPair(authSignKeyConstants, "My user password")
        authEncryptionSecretKey = await KeyConstantsHelper.getEncryptionKey(authEncryptionKeyConstants, "My user password")

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
        expect(user.publicAuthSignKey).toBeUndefined();
        expect(user.encryptedPrivateKey).toBeUndefined();
        expect(user.authSignKeyConstants).toBeUndefined();
        expect(user.authEncryptionKeyConstants).toBeUndefined();
        expect(user.savedProperties.get("publicAuthSignKey")).toBeUndefined();
        expect(user.savedProperties.get("encryptedPrivateKey")).toBeUndefined();
        expect(user.savedProperties.get("authSignKeyConstants")).toBeUndefined();
        expect(user.savedProperties.get("authEncryptionKeyConstants")).toBeUndefined();
        expect(user.id).toEqual(existingUserId)
    });

    test("Create a user", async () => {
        const user: any = await User.register(organization, "test@domain.com", userKeyPair.publicKey, authSignKeyPair.publicKey, await Sodium.encryptMessage(userKeyPair.privateKey, authEncryptionSecretKey), authSignKeyConstants, authEncryptionKeyConstants);
        expect(user).toBeDefined();
        expect(user).toBeInstanceOf(User);
        expect(user.publicAuthSignKey).toBeUndefined();
        expect(user.encryptedPrivateKey).toBeUndefined();
        expect(user.authSignKeyConstants).toBeUndefined();
        expect(user.authEncryptionKeyConstants).toBeUndefined();
        expect(user.savedProperties.get("publicAuthSignKey")).toBeUndefined();
        expect(user.savedProperties.get("encryptedPrivateKey")).toBeUndefined();
        expect(user.savedProperties.get("authSignKeyConstants")).toBeUndefined();
        expect(user.savedProperties.get("authEncryptionKeyConstants")).toBeUndefined();
        expect(user.id).not.toBeEmpty()
    });

    test("Create a user with an email that already exists", async () => {
        const user: any = await User.register(organization, "existing@domain.com", userKeyPair.publicKey, authSignKeyPair.publicKey, await Sodium.encryptMessage(userKeyPair.privateKey, authEncryptionSecretKey), authSignKeyConstants, authEncryptionKeyConstants);
        expect(user).toBeUndefined();
    });

    /*test("Login a user", async () => {
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
    });*/
});
