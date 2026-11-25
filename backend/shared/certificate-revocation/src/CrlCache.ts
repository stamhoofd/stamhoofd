import { MAXIMUM_FRESHNESS_IN_MS } from './Freshness.js';
import type { RevocationHttpClient } from './RevocationHttpClient.js';

/** A revocation list of a public certificate authority is hundreds of kilobytes. */
const MAXIMUM_BYTES = 10 * 1024 * 1024;

export interface FetchedCrl {
    bytes: Uint8Array;
    /** Handed back so that re-reading a cached list cannot keep pushing its own expiry forward. */
    fetchedAt: Date;
}

/** Fetching a list costs seconds, while it is the same list for every verification. */
export class CrlCache {
    private readonly entries = new Map<string, { bytes: Uint8Array; fetchedAt: Date; expiresAt: Date }>();
    private readonly pending = new Map<string, Promise<FetchedCrl>>();

    /** How many lists are kept, so a test can see that an expired one is gone rather than stale. */
    get size(): number {
        return this.entries.size;
    }

    /** A fetched list is not kept: only the caller can say whether it is one worth keeping. */
    async fetch(url: string, client: RevocationHttpClient): Promise<FetchedCrl> {
        const cached = this.entries.get(url);

        if (cached) {
            if (cached.expiresAt > new Date()) {
                return { bytes: cached.bytes, fetchedAt: cached.fetchedAt };
            }

            this.entries.delete(url);
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
     * how long we keep it. One that names none is kept a day, as long as anything else here.
     */
    store(url: string, { bytes, fetchedAt }: FetchedCrl, nextUpdate: Date | null): void {
        this.evictExpired();

        const ceiling = new Date(fetchedAt.getTime() + MAXIMUM_FRESHNESS_IN_MS);
        const expiresAt = nextUpdate !== null && nextUpdate < ceiling ? nextUpdate : ceiling;

        if (expiresAt <= new Date()) {
            return;
        }

        this.entries.set(url, { bytes, fetchedAt, expiresAt });
    }

    /**
     * A url nobody asks for again would otherwise keep its list here for the lifetime of the process,
     * since an entry is only ever replaced by the fetch that found it expired.
     */
    private evictExpired(): void {
        const now = new Date();

        for (const [url, entry] of this.entries) {
            if (entry.expiresAt <= now) {
                this.entries.delete(url);
            }
        }
    }
}

export const sharedCrlCache = new CrlCache();
