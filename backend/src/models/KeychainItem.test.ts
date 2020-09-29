import { UserFactory } from '../factories/UserFactory';
import { KeychainItem } from "./KeychainItem";

describe("Model.KeychainItem", () => {

    test("Create a keychain item for a user", async () => {
        const user = await new UserFactory({}).create()
        expect(user).toBeDefined();
        if (!user) return;

        const item = new KeychainItem()
        item.userId = user.id
        item.publicKey = ""
        item.encryptedPrivateKey = ""

        await item.save();
        expect(item.id).toBeDefined()
    });
});
