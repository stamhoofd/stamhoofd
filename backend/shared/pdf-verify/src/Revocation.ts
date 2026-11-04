import { SimpleError } from '@common/errors';
import type * as pkijs from 'pkijs';
import { getCrlUrls, getOcspUrls } from './CertificateUrls.js';
import { checkCrl } from './Crl.js';
import type { CrlCache } from './CrlCache.js';
import { sharedCrlCache } from './CrlCache.js';
import { checkOcsp } from './Ocsp.js';
import type { RevocationHttpClient } from './RevocationHttpClient.js';
import { FetchRevocationHttpClient } from './RevocationHttpClient.js';

export type RevocationStatus = 'good' | 'revoked' | 'unknown';

/** Replaces the network and the list cache, so the checks can be tested without either. */
export interface RevocationOptions {
    client?: RevocationHttpClient;
    cache?: CrlCache;
}

export interface CertificateAndIssuer {
    certificate: pkijs.Certificate;
    issuer: pkijs.Certificate;
    /** For the message that says which certificate is the problem. */
    name: string;
}

/** OCSP first, the revocation list after. */
export async function checkCertificateRevocation(certificate: pkijs.Certificate, issuer: pkijs.Certificate, options: RevocationOptions = {}): Promise<RevocationStatus> {
    const client = options.client ?? new FetchRevocationHttpClient();
    const cache = options.cache ?? sharedCrlCache;

    for (const url of getOcspUrls(certificate)) {
        const status = await checkOcsp(certificate, issuer, url, client);

        if (status !== 'unknown') {
            return status;
        }
    }

    for (const url of getCrlUrls(certificate)) {
        const status = await checkCrl(certificate, issuer, url, { client, cache });

        if (status !== 'unknown') {
            return status;
        }
    }

    return 'unknown';
}

/**
 * Checks every certificate of the chain, the trust anchor aside: that one is pinned by the hash of
 * its public key.
 *
 * Throws a `SimpleError` when one is revoked, and when a status could not be established.
 */
export async function assertChainNotRevoked(chain: CertificateAndIssuer[], signerName: string, options: RevocationOptions = {}): Promise<void> {
    let unknown: string | null = null;

    for (const { certificate, issuer, name } of chain) {
        const status = await checkCertificateRevocation(certificate, issuer, options);

        if (status === 'revoked') {
            throw new SimpleError({
                code: 'certificate_revoked',
                message: `The certificate of ${name} was revoked.`,
                human: $t('De digitale ondertekening van dit bestand werd ingetrokken. Vraag een nieuw document aan bij {signerName} en laad dat op.', { signerName }),
                statusCode: 400,
            });
        }

        if (status === 'unknown' && unknown === null) {
            unknown = name;
        }
    }

    if (unknown !== null) {
        throw new SimpleError({
            code: 'revocation_unavailable',
            message: `Whether the certificate of ${unknown} is still valid could not be established.`,
            human: $t('We konden de digitale ondertekening van dit bestand niet volledig controleren.'),
            statusCode: 400,
        });
    }
}
