import * as jose from 'jose';

import { BelcotaxConfig } from './BelcotaxConfig.js';

type LoadedKey = { privateKey: jose.KeyLike; publicJwk: jose.JWK; kid: string };

const privateParameters = ['d', 'p', 'q', 'dp', 'dq', 'qi', 'oth', 'k'];

/**
 * The key that signs our client assertion (private_key_jwt). FOD fetches the public part from
 * our JWKS URL to check it.
 */
export class BelcotaxClientKeys {
    static readonly alg = 'RS256';

    private static loaded: Promise<LoadedKey | null> | null = null;

    static reset() {
        this.loaded = null;
    }

    static async get(): Promise<LoadedKey | null> {
        if (!this.loaded) {
            this.loaded = this.load().catch((e) => {
                this.loaded = null;
                throw e;
            });
        }
        return await this.loaded;
    }

    static async getJwks(): Promise<{ keys: jose.JWK[] }> {
        const key = await this.get();
        return { keys: key ? [key.publicJwk] : [] };
    }

    private static async load(): Promise<LoadedKey | null> {
        let privateJwk = STAMHOOFD.BELCOTAX_PRIVATE_KEY;

        if (!privateJwk) {
            // Development gets the key of the local realm from `stam`; tests mock the other side
            if (STAMHOOFD.environment !== 'test') {
                return null;
            }
            const { privateKey } = await jose.generateKeyPair(this.alg, { extractable: true });
            privateJwk = await jose.exportJWK(privateKey);
        }

        const publicJwk = Object.fromEntries(
            Object.entries(privateJwk).filter(([key]) => !privateParameters.includes(key)),
        ) as jose.JWK;
        const kid = privateJwk.kid ?? (await jose.calculateJwkThumbprint(publicJwk));

        return {
            privateKey: (await jose.importJWK(
                { ...privateJwk, alg: this.alg },
                this.alg,
            )) as jose.KeyLike,
            publicJwk: { ...publicJwk, kid, use: 'sig', alg: this.alg },
            kid,
        };
    }

    /**
     * RFC 7523 client assertion in the exact shape FOD documents (§4.3.1.1): `typ` and `kid` in the
     * header, a single `aud` string (the token endpoint) and an expiry below 30 minutes.
     */
    static async createClientAssertion(audience: string): Promise<string> {
        const key = await this.get();
        if (!key) {
            throw BelcotaxConfig.notConfiguredError();
        }
        const clientId = BelcotaxConfig.clientId;

        return await new jose.SignJWT({})
            .setProtectedHeader({ alg: this.alg, typ: 'JWT', kid: key.kid })
            .setIssuer(clientId)
            .setSubject(clientId)
            .setAudience(audience)
            .setIssuedAt()
            .setExpirationTime('5m')
            .setJti(crypto.randomUUID())
            .sign(key.privateKey);
    }
}
