import { Sodium } from "./Sodium";

describe("Sodium", () => {
    beforeAll( () => {
        // todo
    });

    test("Authenticated public-key encryption", async () => {
        // Start of with generating a public  / private key pair
        const receiverKeypair = await Sodium.boxKeyPair()
        const senderKeypair = await Sodium.boxKeyPair()

        // Encrypt a message and send it to the receiver
        const plaintext = "This is a text 😄"
        const cyphertext = await Sodium.sealMessageAuthenticated(plaintext, receiverKeypair.publicKey, senderKeypair.privateKey)

        // The receiver decrypts the message...
        await expect(Sodium.unsealMessageAuthenticated(cyphertext, senderKeypair.publicKey, receiverKeypair.privateKey)).resolves.toEqual(plaintext)

        // Test decryption fails
        await expect(Sodium.unsealMessageAuthenticated(cyphertext, senderKeypair.publicKey, senderKeypair.privateKey)).rejects.toThrow(/incorrect key pair/)

        // Test authentication fails
        await expect(Sodium.unsealMessageAuthenticated(cyphertext, receiverKeypair.publicKey, receiverKeypair.privateKey)).rejects.toThrow(/incorrect key pair/)
    });

    test("Authenticated public-key encryption for yourself", async () => {
        // Start of with generating a public  / private key pair
        const senderKeypair = await Sodium.boxKeyPair()

        // Encrypt a message and send it to the receiver
        // We use some special UTF8 characters to test if the encoding is not broken during decryption
        const plaintext = "😂 👌🏾This is a text 😄"
        const cyphertext = await Sodium.sealMessageAuthenticated(plaintext, senderKeypair.publicKey, senderKeypair.privateKey)

        // The receiver decrypts the message...
        await expect(Sodium.unsealMessageAuthenticated(cyphertext, senderKeypair.publicKey, senderKeypair.privateKey)).resolves.toEqual(plaintext)
    });

    test("Anonymous public-key encryption", async () => {
        // Start of with generating a public  / private key pair
        const receiverKeypair = await Sodium.boxKeyPair()
        const senderKeypair = await Sodium.boxKeyPair()

        // Encrypt a message and send it to the receiver
        const plaintext = "This is a text 😄"
        const cyphertext = await Sodium.sealMessage(plaintext, receiverKeypair.publicKey)

        // The receiver decrypts the message...
        await expect(Sodium.unsealMessage(cyphertext, receiverKeypair.publicKey, receiverKeypair.privateKey)).resolves.toEqual(plaintext)

        // Test decryption fails
        await expect(Sodium.unsealMessage(cyphertext, senderKeypair.publicKey, senderKeypair.privateKey)).rejects.toThrow(/incorrect key pair/)
        await expect(Sodium.unsealMessage(cyphertext, receiverKeypair.publicKey, senderKeypair.privateKey)).rejects.toThrow(/incorrect key pair/)
        await expect(Sodium.unsealMessage(cyphertext, senderKeypair.publicKey, receiverKeypair.privateKey)).rejects.toThrow(/incorrect key pair/)
    });
});
