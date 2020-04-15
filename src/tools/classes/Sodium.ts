import sodium, { KeyPair, Uint8ArrayOutputFormat, StringOutputFormat, StringKeyPair } from "libsodium-wrappers";

class Sodium {
    loaded = false;

    async loadIfNeeded() {
        await sodium.ready;
        this.loaded = true;
    }

    async boxKeypair(): Promise<StringKeyPair> {
        await this.loadIfNeeded();
        const keypair = sodium.crypto_box_keypair();

        return {
            publicKey: Buffer.from(keypair.publicKey).toString("base64"),
            privateKey: Buffer.from(keypair.privateKey).toString("base64"),
            keyType: keypair.keyType,
        };
    }
}

export default new Sodium();
