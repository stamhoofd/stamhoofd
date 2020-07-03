import sodium, { StringKeyPair } from "libsodium-wrappers";

class SodiumStatic {
    loaded = false;

    async loadIfNeeded() {
        await sodium.ready;
        this.loaded = true;
    }

    async boxKeyPair(): Promise<StringKeyPair> {
        await this.loadIfNeeded();
        const keypair = sodium.crypto_box_keypair();

        // Somehow, the base64 encoding of sodium.js is not working correctly? (need to check and add test in libsodium)
        return {
            publicKey: Buffer.from(keypair.publicKey).toString("base64"),
            privateKey: Buffer.from(keypair.privateKey).toString("base64"),
            keyType: keypair.keyType,
        };
    }

    async signKeyPair(): Promise<StringKeyPair> {
        await this.loadIfNeeded();
        const keypair = sodium.crypto_sign_keypair();

        return {
            publicKey: Buffer.from(keypair.publicKey).toString("base64"),
            privateKey: Buffer.from(keypair.privateKey).toString("base64"),
            keyType: keypair.keyType,
        };
    }

    async verifySignature(signature: string, message: string, publicKey: string): Promise<boolean> {
        await this.loadIfNeeded();
        return sodium.crypto_sign_verify_detached(Buffer.from(signature, "base64"), message, Buffer.from(publicKey, "base64"));
    }

    async signMessage(message: string, privateKey: string): Promise<string> {
        await this.loadIfNeeded();
        return Buffer.from(sodium.crypto_sign_detached(message, Buffer.from(privateKey, "base64"))).toString("base64");
    }

    async sealMessage(message: string, publicKey: string): Promise<string> {
        await this.loadIfNeeded();
        return Buffer.from(sodium.crypto_box_seal(Buffer.from(message, "utf8"), Buffer.from(publicKey, "base64"))).toString("base64");
    }

    async unsealMessage(ciphertext: string, publicKey: string, privateKey: string): Promise<string> {
        await this.loadIfNeeded();
        return Buffer.from(sodium.crypto_box_seal_open(Buffer.from(ciphertext, "base64"), Buffer.from(publicKey, "base64"), Buffer.from(privateKey, "base64"))).toString("utf8");
    }
}

export const Sodium = new SodiumStatic();
