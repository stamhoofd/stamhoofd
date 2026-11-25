import { isCertificateAuthority } from '@stamhoofd/signed-pdf/Certificates.js';
import * as pkijs from 'pkijs';

const DELTA_CRL_INDICATOR_OID = '2.5.29.27';
const ISSUING_DISTRIBUTION_POINT_OID = '2.5.29.28';
const URI_GENERAL_NAME = 6;

/**
 * Whether being absent from this list is an answer about this certificate.
 *
 * A list may say it covers only part of what its issuer handed out: certain revocation reasons, only
 * end entities or only authorities, one distribution point, the certificates of other issuers, or
 * only what changed since a base list. Absence from such a list is not the same as not being revoked,
 * so a scope that does not demonstrably hold our certificate leaves the status unestablished.
 */
export function coversCertificate(list: pkijs.CertificateRevocationList, certificate: pkijs.Certificate, url: string): boolean {
    const extensions = list.crlExtensions?.extensions ?? [];

    // A delta list holds what changed since a base list we never read, so it answers for nothing
    if (extensions.some(extension => extension.extnID === DELTA_CRL_INDICATOR_OID)) {
        return false;
    }

    const extension = extensions.find(candidate => candidate.extnID === ISSUING_DISTRIBUTION_POINT_OID);

    if (extension === undefined) {
        return true;
    }

    let point: pkijs.IssuingDistributionPoint;

    try {
        point = pkijs.IssuingDistributionPoint.fromBER(extension.extnValue.valueBlock.valueHexView.slice().buffer as ArrayBuffer);
    } catch {
        return false;
    }

    // An indirect list carries entries of other issuers, each naming its own, which this does not read
    if (point.onlySomeReasons !== undefined || point.indirectCRL || point.onlyContainsAttributeCerts) {
        return false;
    }

    if (point.onlyContainsUserCerts && isCertificateAuthority(certificate)) {
        return false;
    }

    if (point.onlyContainsCACerts && !isCertificateAuthority(certificate)) {
        return false;
    }

    return point.distributionPoint === undefined || namesUrl(point.distributionPoint, url);
}

/**
 * The url is the one named in the certificate we are asking about, so a list that names it back is
 * the list for that certificate. A name relative to the CRL issuer names nothing we can compare.
 */
function namesUrl(distributionPoint: pkijs.DistributionPointName, url: string): boolean {
    return Array.isArray(distributionPoint)
        && distributionPoint.some(name => name.type === URI_GENERAL_NAME && String(name.value) === url);
}
