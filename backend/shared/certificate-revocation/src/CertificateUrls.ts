import * as pkijs from 'pkijs';

const AUTHORITY_INFO_ACCESS_OID = '1.3.6.1.5.5.7.1.1';
const CRL_DISTRIBUTION_POINTS_OID = '2.5.29.31';
const OCSP_ACCESS_METHOD_OID = '1.3.6.1.5.5.7.48.1';
const URI_GENERAL_NAME = 6;

export function getOcspUrls(certificate: pkijs.Certificate): string[] {
    const extension = findExtension(certificate, AUTHORITY_INFO_ACCESS_OID);

    if (extension === null) {
        return [];
    }

    let infoAccess: pkijs.InfoAccess;

    try {
        infoAccess = pkijs.InfoAccess.fromBER(extension);
    } catch {
        return [];
    }

    return acceptableUrls(infoAccess.accessDescriptions
        .filter(description => description.accessMethod === OCSP_ACCESS_METHOD_OID)
        .map(description => description.accessLocation)
        .filter(location => location.type === URI_GENERAL_NAME)
        .map(location => String(location.value)));
}

export function getCrlUrls(certificate: pkijs.Certificate): string[] {
    const extension = findExtension(certificate, CRL_DISTRIBUTION_POINTS_OID);

    if (extension === null) {
        return [];
    }

    let distributionPoints: pkijs.CRLDistributionPoints;

    try {
        distributionPoints = pkijs.CRLDistributionPoints.fromBER(extension);
    } catch {
        return [];
    }

    const urls: string[] = [];

    for (const point of distributionPoints.distributionPoints) {
        if (!Array.isArray(point.distributionPoint)) {
            // A name relative to the CRL issuer, which we cannot resolve to a url
            continue;
        }

        for (const name of point.distributionPoint) {
            if (name.type === URI_GENERAL_NAME) {
                urls.push(String(name.value));
            }
        }
    }

    return acceptableUrls(urls);
}

/**
 * These urls come out of a certificate, so they are treated as input even though the chain they
 * belong to is already pinned. Plain http is normal here: the responses are signed, so the transport
 * is not what we trust. An address of our own network is not.
 *
 * A name that resolves to such an address still gets through, which no check here can see; this
 * turns away the shapes that say so in the url itself.
 */
function acceptableUrls(urls: string[]): string[] {
    return urls.filter((url) => {
        let parsed: URL;

        try {
            parsed = new URL(url);
        } catch {
            return false;
        }

        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return false;
        }

        return !isLocalHostname(parsed.hostname);
    });
}

function isLocalHostname(hostname: string): boolean {
    const name = hostname.toLowerCase();

    // [::1] keeps its brackets in URL.hostname
    if (name.startsWith('[') || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(name)) {
        return true;
    }

    // A bare name is a name of this network, and these suffixes are reserved for one
    return !name.includes('.')
        || name === 'localhost'
        || name.endsWith('.localhost')
        || name.endsWith('.local')
        || name.endsWith('.internal')
        || name.endsWith('.home.arpa');
}

function findExtension(certificate: pkijs.Certificate, oid: string): ArrayBuffer | null {
    const extension = (certificate.extensions ?? []).find(candidate => candidate.extnID === oid);

    if (!extension) {
        return null;
    }

    return extension.extnValue.valueBlock.valueHexView.slice().buffer as ArrayBuffer;
}
