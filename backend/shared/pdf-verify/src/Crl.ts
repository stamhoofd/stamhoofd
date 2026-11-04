import * as pkijs from 'pkijs';
import type { CrlCache } from './CrlCache.js';
import type { RevocationHttpClient } from './RevocationHttpClient.js';
import type { RevocationStatus } from './Revocation.js';

const CLOCK_TOLERANCE_IN_MS = 5 * 60 * 1000;

export interface CrlOptions {
    client: RevocationHttpClient;
    cache: CrlCache;
}

/** The fallback for OCSP: one signed file per authority, so it can be cached. */
export async function checkCrl(certificate: pkijs.Certificate, issuer: pkijs.Certificate, url: string, options: CrlOptions): Promise<RevocationStatus> {
    const list = await readCrl(url, issuer, options);

    if (list === null) {
        return 'unknown';
    }

    return list.isCertificateRevoked(certificate) ? 'revoked' : 'good';
}

async function readCrl(url: string, issuer: pkijs.Certificate, { client, cache }: CrlOptions): Promise<pkijs.CertificateRevocationList | null> {
    let list: pkijs.CertificateRevocationList;
    let bytes: Uint8Array;

    try {
        bytes = await cache.fetch(url, client);
        list = pkijs.CertificateRevocationList.fromBER(bytes.slice().buffer as ArrayBuffer);

        if (!await list.verify({ issuerCertificate: issuer })) {
            return null;
        }
    } catch {
        return null;
    }

    const now = new Date();
    const thisUpdate = list.thisUpdate.value;
    const nextUpdate = list.nextUpdate?.value ?? null;

    if (thisUpdate.getTime() > now.getTime() + CLOCK_TOLERANCE_IN_MS) {
        return null;
    }

    if (nextUpdate !== null && nextUpdate.getTime() < now.getTime() - CLOCK_TOLERANCE_IN_MS) {
        // The authority has published a newer list, so this one no longer says anything
        return null;
    }

    // Only now that it verified: a list that does not would otherwise keep every delivery waiting
    // on the same bad file until it expired.
    cache.store(url, bytes, nextUpdate);

    return list;
}
