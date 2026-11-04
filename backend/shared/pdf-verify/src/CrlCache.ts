import type { RevocationHttpClient } from './RevocationHttpClient.js';

/** Fetching a list costs seconds, while it is the same for every verification. */
/** A revocation list of a public certificate authority is hundreds of kilobytes. */
const MAXIMUM_BYTES = 10 * 1024 * 1024;

/** However far away a list says its own nextUpdate is, it is not kept longer than this. */
const MAXIMUM_AGE_IN_MS = 24 * 60 * 60 * 1000;

export class CrlCache {
    private readonly entries = new Map<string, { bytes: Uint8Array; expiresAt: Date }>();
    private readonly pending = new Map<string, Promise<Uint8Array>>();

    /** A fetched list is not kept: only the caller can say whether it is one worth keeping. */
    async fetch(url: string, client: RevocationHttpClient): Promise<Uint8Array> {
        const cached = this.entries.get(url);

        if (cached && cached.expiresAt > new Date()) {
            return cached.bytes;
        }

        // One fetch per url at a time, so a burst of deliveries does not fetch the same list at once
        const pending = this.pending.get(url);

        if (pending) {
            return await pending;
        }

        const fetching = client.get(url, MAXIMUM_BYTES).finally(() => this.pending.delete(url));
        this.pending.set(url, fetching);

        return await fetching;
    }

    /**
     * `nextUpdate` sits inside the signed list, so only a caller that checked that signature may say
     * how long we keep it.
     */
    store(url: string, bytes: Uint8Array, nextUpdate: Date | null): void {
        const now = new Date();
        const ceiling = new Date(now.getTime() + MAXIMUM_AGE_IN_MS);
        const expiresAt = nextUpdate !== null && nextUpdate < ceiling ? nextUpdate : ceiling;

        if (expiresAt <= now) {
            return;
        }

        this.entries.set(url, { bytes, expiresAt });
    }
}

export const sharedCrlCache = new CrlCache();
