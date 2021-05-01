import { KeyConstantsHelper, SensitivityLevel,Sodium } from '@stamhoofd/crypto';
import { KeyConstants, NewUser } from '@stamhoofd/structures';

import { OrganizationFactory } from "../factories/OrganizationFactory";
import { UserFactory } from '../factories/UserFactory';
import { Organization } from "./Organization";
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
        const user: any = await User.register(organization, NewUser.create({
            email: "test@domain.com",
            publicKey: userKeyPair.publicKey, 
            publicAuthSignKey: authSignKeyPair.publicKey, 
            encryptedPrivateKey: await Sodium.encryptMessage(userKeyPair.privateKey, authEncryptionSecretKey),
            authSignKeyConstants, 
            authEncryptionKeyConstants
        }));
            
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
        const user: any = await User.register(organization, NewUser.create({
            email: "existing@domain.com",
            publicKey: userKeyPair.publicKey, 
            publicAuthSignKey: authSignKeyPair.publicKey, 
            encryptedPrivateKey: await Sodium.encryptMessage(userKeyPair.privateKey, authEncryptionSecretKey),
            authSignKeyConstants, 
            authEncryptionKeyConstants
        }));
        expect(user).toBeUndefined();
    });
});
