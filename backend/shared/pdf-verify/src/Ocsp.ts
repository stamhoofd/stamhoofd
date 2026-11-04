import * as pkijs from 'pkijs';
import type { RevocationHttpClient } from './RevocationHttpClient.js';
import type { RevocationStatus } from './Revocation.js';

const OCSP_REQUEST_CONTENT_TYPE = 'application/ocsp-request';
const OCSP_RESPONSE_SUCCESSFUL = 0;
const OCSP_STATUS_GOOD = 0;
const OCSP_STATUS_REVOKED = 1;

/** Everything we cannot establish is `unknown`: an unverified response could say anything. */
export async function checkOcsp(certificate: pkijs.Certificate, issuer: pkijs.Certificate, url: string, client: RevocationHttpClient): Promise<RevocationStatus> {
    const request = new pkijs.OCSPRequest();

    try {
        await request.createForCertificate(certificate, { hashAlgorithm: 'SHA-256', issuerCertificate: issuer });
    } catch {
        return 'unknown';
    }

    let response: pkijs.OCSPResponse;

    try {
        const bytes = await client.post(url, new Uint8Array(request.toSchema(true).toBER(false)), OCSP_REQUEST_CONTENT_TYPE);
        response = pkijs.OCSPResponse.fromBER(bytes.slice().buffer as ArrayBuffer);
    } catch {
        return 'unknown';
    }

    if (response.responseStatus.valueBlock.valueDec !== OCSP_RESPONSE_SUCCESSFUL) {
        // tryLater, unauthorized, malformedRequest: none of them is a status
        return 'unknown';
    }

    if (response.responseBytes === undefined || response.responseBytes.responseType !== pkijs.id_PKIX_OCSP_Basic) {
        return 'unknown';
    }

    try {
        const basic = pkijs.BasicOCSPResponse.fromBER(response.responseBytes.response.valueBlock.valueHexView.slice().buffer as ArrayBuffer);

        // The issuer may be the anchor here: the chain it belongs to was pinned before we got
        // here. It is also an authorized responder, since answering about its own certificates
        // needs no delegation - its signature still has to hold.
        if (!await basic.verify({ trustedCerts: [issuer], issuerCerts: [issuer], trustedResponders: [issuer] })) {
            return 'unknown';
        }

        const status = await basic.getCertificateStatus(certificate, issuer);

        if (!status.isForCertificate) {
            return 'unknown';
        }

        if (status.status === OCSP_STATUS_REVOKED) {
            return 'revoked';
        }

        return status.status === OCSP_STATUS_GOOD ? 'good' : 'unknown';
    } catch {
        return 'unknown';
    }
}
