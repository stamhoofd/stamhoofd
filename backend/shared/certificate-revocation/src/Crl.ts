import * as pkijs from 'pkijs';
import type { CrlCache, FetchedCrl } from './CrlCache.js';
import { isCurrent } from './Freshness.js';
import type { RevocationHttpClient } from './RevocationHttpClient.js';
import type { RevocationStatus } from './Revocation.js';

export interface CrlOptions {
    client: RevocationHttpClient;
    cache: CrlCache;
}

export async function checkCrl(certificate: pkijs.Certificate, issuer: pkijs.Certificate, url: string, options: CrlOptions): Promise<RevocationStatus> {
    const list = await readCrl(url, issuer, options);

    if (list === null) {
        return 'unknown';
    }

    return list.isCertificateRevoked(certificate) ? 'revoked' : 'good';
}

async function readCrl(url: string, issuer: pkijs.Certificate, { client, cache }: CrlOptions): Promise<pkijs.CertificateRevocationList | null> {
    let list: pkijs.CertificateRevocationList;
    let fetched: FetchedCrl;

    try {
        fetched = await cache.fetch(url, client);
        list = pkijs.CertificateRevocationList.fromBER(fetched.bytes.slice().buffer as ArrayBuffer);

        if (!await list.verify({ issuerCertificate: issuer })) {
            return null;
        }
    } catch {
        return null;
    }

    if (!isCurrent(list.thisUpdate.value, list.nextUpdate?.value ?? null)) {
        return null;
    }

    // Only now that it verified: a list that does not would otherwise keep every delivery waiting
    // on the same bad file until it expired.
    cache.store(url, fetched, list.nextUpdate?.value ?? null);

    return list;
}
