import * as asn1js from 'asn1js';
import * as pkijs from 'pkijs';
import { isCurrent, isNotInTheFuture } from './Freshness.js';
import type { RevocationHttpClient } from './RevocationHttpClient.js';
import type { RevocationStatus } from './Revocation.js';

const OCSP_REQUEST_CONTENT_TYPE = 'application/ocsp-request';
const OCSP_RESPONSE_SUCCESSFUL = 0;
const OCSP_STATUS_GOOD = 0;
const OCSP_STATUS_REVOKED = 1;
const NONCE_OID = '1.3.6.1.5.5.7.48.1.2';
const NONCE_SIZE_IN_BYTES = 16;

/** Everything we cannot establish is `unknown`: an unverified response could say anything. */
export async function checkOcsp(certificate: pkijs.Certificate, issuer: pkijs.Certificate, url: string, client: RevocationHttpClient): Promise<RevocationStatus> {
    const crypto = pkijs.getCrypto(true);
    const request = new pkijs.OCSPRequest();

    try {
        await request.createForCertificate(certificate, { hashAlgorithm: 'SHA-256', issuerCertificate: issuer });
    } catch {
        return 'unknown';
    }

    // Proves the answer is this one rather than one given before a revocation. Responders answering
    // from pre-produced files leave it out, so the freshness checks below have to carry that case.
    const nonce = crypto.getRandomValues(new Uint8Array(NONCE_SIZE_IN_BYTES));
    const sentNonce = new Uint8Array(new asn1js.OctetString({ valueHex: nonce.slice().buffer as ArrayBuffer }).toBER(false));

    request.tbsRequest.requestExtensions = [new pkijs.Extension({
        extnID: NONCE_OID,
        critical: false,
        extnValue: sentNonce.slice().buffer as ArrayBuffer,
    })];

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

        if (basic.certs === undefined || basic.certs.length === 0) {
            // RFC 6960 lets a response the issuer signed itself leave out the certificate we already
            // hold. pkijs refuses to verify without one, so hand it the issuer: the signature still
            // has to hold under that key.
            basic.certs = [issuer];
        }

        // Trusting the issuer is safe: its chain was pinned before we got here. `trustedResponders`
        // is what makes pkijs accept a response the issuer signed itself - without it the responder's
        // own chain is validated, and a self-signed root cannot be the end entity of its own.
        if (!await basic.verify({ trustedCerts: [issuer], issuerCerts: [issuer], trustedResponders: [issuer] })) {
            return 'unknown';
        }

        if (!echoesNonce(basic, sentNonce)) {
            return 'unknown';
        }

        if (!isNotInTheFuture(basic.tbsResponseData.producedAt)) {
            return 'unknown';
        }

        const status = await basic.getCertificateStatus(certificate, issuer);

        if (!status.isForCertificate) {
            return 'unknown';
        }

        // Looked up again because the call above answers with a status, not with the entry that
        // carried it - and the freshness window has to be read off that same entry.
        const single = await findSingleResponse(basic, certificate, issuer);

        if (single === null || !isCurrent(single.thisUpdate, single.nextUpdate ?? null)) {
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

/** Sending none at all is allowed: the responder is answering from a file it prepared earlier. */
function echoesNonce(basic: pkijs.BasicOCSPResponse, sent: Uint8Array): boolean {
    const extension = (basic.tbsResponseData.responseExtensions ?? []).find(candidate => candidate.extnID === NONCE_OID);

    if (extension === undefined) {
        return true;
    }

    const received = extension.extnValue.valueBlock.valueHexView;

    return received.length === sent.length && received.every((byte, index) => byte === sent[index]);
}

async function findSingleResponse(basic: pkijs.BasicOCSPResponse, certificate: pkijs.Certificate, issuer: pkijs.Certificate): Promise<pkijs.SingleResponse | null> {
    const crypto = pkijs.getCrypto(true);

    for (const single of basic.tbsResponseData.responses) {
        const algorithm = crypto.getAlgorithmByOID(single.certID.hashAlgorithm.algorithmId, false);

        if (algorithm === undefined || !('name' in algorithm)) {
            continue;
        }

        const certID = new pkijs.CertID();

        try {
            await certID.createForCertificate(certificate, { hashAlgorithm: algorithm.name as string, issuerCertificate: issuer }, crypto);
        } catch {
            continue;
        }

        if (single.certID.isEqual(certID)) {
            return single;
        }
    }

    return null;
}
