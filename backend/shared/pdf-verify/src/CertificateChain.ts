import { getSubjectAttribute } from '@stamhoofd/pdf-verify-core/Certificates.js';
import type * as pkijs from 'pkijs';
import type { CertificateAndIssuer } from './Revocation.js';

const COMMON_NAME_OID = '2.5.4.3';

/**
 * Pairs every certificate of a validated path with the one that issued it, the trust anchor aside:
 * that one is pinned by the hash of its public key rather than looked up.
 *
 * The path has to be the one the signature was validated against. The certificate set of a signature
 * container is not covered by that signature, so reading a chain back out of it by subject name
 * would pick whichever certificate carries the right name rather than the one that signed.
 */
export function toCertificateChain(certificatePath: pkijs.Certificate[]): CertificateAndIssuer[] {
    const chain: CertificateAndIssuer[] = [];

    for (let index = 0; index + 1 < certificatePath.length; index++) {
        const certificate = certificatePath[index];

        chain.push({
            certificate,
            issuer: certificatePath[index + 1],
            name: getSubjectAttribute(certificate, COMMON_NAME_OID) ?? 'unnamed certificate',
        });
    }

    return chain;
}
