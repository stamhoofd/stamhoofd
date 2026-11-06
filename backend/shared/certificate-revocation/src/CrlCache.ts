import { MAXIMUM_FRESHNESS_IN_MS } from './Freshness.js';
import type { RevocationHttpClient } from './RevocationHttpClient.js';

/** A revocation list of a public certificate authority is hundreds of kilobytes. */
const MAXIMUM_BYTES = 10 * 1024 * 1024;

export interface FetchedCrl {
    bytes: Uint8Array;
    /**
     * When these bytes came off the network, which is what their lifetime is counted from. Handing it
     * back means re-reading a cached list cannot keep pushing its own expiry forward.
     */
    fetchedAt: Date;
}

/** Fetching a list costs seconds, while it is the same list for every verification. */
export class CrlCache {
    private readonly entries = new Map<string, { bytes: Uint8Array; fetchedAt: Date; expiresAt: Date }>();
    private readonly pending = new Map<string, Promise<FetchedCrl>>();

    /** A fetched list is not kept: only the caller can say whether it is one worth keeping. */
    async fetch(url: string, client: RevocationHttpClient): Promise<FetchedCrl> {
        const cached = this.entries.get(url);

        if (cached && cached.expiresAt > new Date()) {
            return { bytes: cached.bytes, fetchedAt: cached.fetchedAt };
        }

        // One fetch per url at a time, so a burst of deliveries does not fetch the same list at once
        const pending = this.pending.get(url);

        if (pending) {
            return await pending;
        }

        const fetching = client.get(url, MAXIMUM_BYTES)
            .then(bytes => ({ bytes, fetchedAt: new Date() }))
            .finally(() => this.pending.delete(url));

        this.pending.set(url, fetching);

        return await fetching;
    }

    /**
     * `nextUpdate` sits inside the signed list, so only a caller that checked that signature may say
     * how long we keep it. A list that names none is kept a day from the moment it was fetched, which
     * is as long as anything else here is believed without being told so.
     */
    store(url: string, { bytes, fetchedAt }: FetchedCrl, nextUpdate: Date | null): void {
        const ceiling = new Date(fetchedAt.getTime() + MAXIMUM_FRESHNESS_IN_MS);
        const expiresAt = nextUpdate !== null && nextUpdate < ceiling ? nextUpdate : ceiling;

        if (expiresAt <= new Date()) {
            return;
        }

        this.entries.set(url, { bytes, fetchedAt, expiresAt });
    }
}

export const sharedCrlCache = new CrlCache();
