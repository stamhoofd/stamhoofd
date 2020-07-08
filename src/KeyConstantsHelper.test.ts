import { KeyConstantsHelper, SensitivityLevel } from './KeyConstantsHelper';
import { Sodium } from "./Sodium";

describe("KeyConstantsHelper", () => {
    beforeAll( () => {
        // todo
    });

    test("Sign keys always the same for the same constants and password", async () => {
        const constants = await KeyConstantsHelper.create(SensitivityLevel.User)
        await expect(KeyConstantsHelper.getSignKeyPair(constants, "my test password")).resolves.toEqual(await KeyConstantsHelper.getSignKeyPair(constants, "my test password"))
    });

    test("Encryption keys always the same for the same constants and password", async () => {
        const constants = await KeyConstantsHelper.create(SensitivityLevel.User)
        await expect(KeyConstantsHelper.getEncryptionKeyPair(constants, "my test password")).resolves.toEqual(await KeyConstantsHelper.getEncryptionKeyPair(constants, "my test password"))
    });

    test("Encryption key always the same for the same constants and password", async () => {
        const constants = await KeyConstantsHelper.create(SensitivityLevel.User)
        await expect(KeyConstantsHelper.getEncryptionKey(constants, "my test password")).resolves.toEqual(await KeyConstantsHelper.getEncryptionKey(constants, "my test password"))
    });

    test("Sign keys do not match for wrong password", async () => {
        const constants = await KeyConstantsHelper.create(SensitivityLevel.User)
        await expect(KeyConstantsHelper.getSignKeyPair(constants, "my test password")).resolves.not.toEqual(await KeyConstantsHelper.getSignKeyPair(constants, "my testpassword"))
    });

    test("Encryption keys do not match for wrong password", async () => {
        const constants = await KeyConstantsHelper.create(SensitivityLevel.User)
        await expect(KeyConstantsHelper.getEncryptionKeyPair(constants, "my test password")).resolves.not.toEqual(await KeyConstantsHelper.getEncryptionKeyPair(constants, "my testpassword"))
    });

    test("Encryption key do not match for wrong password", async () => {
        const constants = await KeyConstantsHelper.create(SensitivityLevel.User)
        await expect(KeyConstantsHelper.getEncryptionKey(constants, "my test password")).resolves.not.toEqual(await KeyConstantsHelper.getEncryptionKey(constants, "my testpassword"))
    });
});
