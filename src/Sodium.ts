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

    async verifySignature(signature: Uint8Array, message: string, publicKey: Uint8Array): Promise<boolean> {
        await this.loadIfNeeded();
        return sodium.crypto_sign_verify_detached(signature, message, publicKey);
    }

    async signMessage(message: string, privateKey: Uint8Array): Promise<string> {
        await this.loadIfNeeded();
        return Buffer.from(sodium.crypto_sign_detached(message, privateKey)).toString("base64");
    }

    async sealMessage(message: string, publicKey: Uint8Array): Promise<string> {
        await this.loadIfNeeded();
        return Buffer.from(sodium.crypto_box_seal(message, publicKey)).toString("base64");
    }
}

export const Sodium = new SodiumStatic();
