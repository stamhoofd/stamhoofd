import { KeyConstantsHelper, SensitivityLevel } from './KeyConstantsHelper';
import { Sodium } from "./Sodium";

describe("KeyConstantsHelper", () => {
    beforeAll( () => {
        // todo
    });

    test("Sign keys always the same for the same constants and password", async () => {
        const constants = await KeyConstantsHelper.create(SensitivityLevel.User)
        await expect(KeyConstantsHelper.getSignKeys(constants, "my test password")).resolves.toEqual(await KeyConstantsHelper.getSignKeys(constants, "my test password"))
    });

    test("Encryption keys always the same for the same constants and password", async () => {
        const constants = await KeyConstantsHelper.create(SensitivityLevel.User)
        await expect(KeyConstantsHelper.getEncryptionKeys(constants, "my test password")).resolves.toEqual(await KeyConstantsHelper.getEncryptionKeys(constants, "my test password"))
    });

    test("Sign keys do not match for wrong password", async () => {
        const constants = await KeyConstantsHelper.create(SensitivityLevel.User)
        await expect(KeyConstantsHelper.getSignKeys(constants, "my test password")).resolves.not.toEqual(await KeyConstantsHelper.getSignKeys(constants, "my testpassword"))
    });

    test("Encryption keys do not match for wrong password", async () => {
        const constants = await KeyConstantsHelper.create(SensitivityLevel.User)
        await expect(KeyConstantsHelper.getEncryptionKeys(constants, "my test password")).resolves.not.toEqual(await KeyConstantsHelper.getEncryptionKeys(constants, "my testpassword"))
    });
});
