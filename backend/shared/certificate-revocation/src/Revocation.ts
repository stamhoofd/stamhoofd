import { SimpleError } from '@common/errors';
import type * as pkijs from 'pkijs';
import { toCertificateChain } from './CertificateChain.js';
import { getCrlUrls, getOcspUrls } from './CertificateUrls.js';
import { checkCrl } from './Crl.js';
import type { CrlCache } from './CrlCache.js';
import { sharedCrlCache } from './CrlCache.js';
import { checkOcsp } from './Ocsp.js';
import type { RevocationHttpClient } from './RevocationHttpClient.js';
import { FetchRevocationHttpClient } from './RevocationHttpClient.js';

export type RevocationStatus = 'good' | 'revoked' | 'unknown';

/** Test seam: replaces the network and the list cache. */
export interface RevocationOptions {
    client?: RevocationHttpClient;
    cache?: CrlCache;
}

export interface CertificateAndIssuer {
    certificate: pkijs.Certificate;
    issuer: pkijs.Certificate;
    name: string;
}

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
 * `certificatePath` is the path a signature check answered with, signer first and anchor last.
 *
 * Throws when a certificate is revoked, and when a status could not be established: accepting a
 * signature we did not finish checking is not an option.
 */
export async function assertChainNotRevoked(certificatePath: pkijs.Certificate[]): Promise<void> {
    await assertLinksNotRevoked(toCertificateChain(certificatePath));
}

/** Separate from the public entry point because it takes the seam the tests stub. */
export async function assertLinksNotRevoked(chain: CertificateAndIssuer[], options: RevocationOptions = {}): Promise<void> {
    let unknown: string | null = null;

    for (const { certificate, issuer, name } of chain) {
        const status = await checkCertificateRevocation(certificate, issuer, options);

        if (status === 'revoked') {
            throw new SimpleError({
                code: 'certificate_revoked',
                message: `The certificate of ${name} was revoked.`,
                human: $t('De digitale ondertekening van dit bestand werd ingetrokken. Vraag een nieuw document aan bij de uitgever en laad dat op.'),
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
            human: $t('We konden de digitale ondertekening van dit bestand niet volledig controleren. Probeer het later opnieuw.'),
            // Nothing is wrong with what was uploaded: an authority did not answer us.
            statusCode: 500,
        });
    }
}
