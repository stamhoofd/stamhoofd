import type { PdfSignaturePolicy } from '@stamhoofd/pdf-verify-core';
import { locatePdfSignature } from '@stamhoofd/pdf-verify-core';
import { getSubjectAttribute, parsePemCertificate } from '@stamhoofd/pdf-verify-core/Certificates.js';
import * as pkijs from 'pkijs';
import type { CertificateAndIssuer } from './Revocation.js';

const SIGNED_DATA_OID = '1.2.840.113549.1.7.2';
const COMMON_NAME_OID = '2.5.4.3';

/** No real chain is this long, and a file that keeps pointing at itself cannot keep us busy. */
const MAXIMUM_CHAIN_LENGTH = 10;

/** The core package answers with a yes, not with the certificates behind it. */
export function readVerifiedChain(bytes: Uint8Array, policy: PdfSignaturePolicy): CertificateAndIssuer[] {
    const { container } = locatePdfSignature(bytes, policy.signerName);
    const contentInfo = pkijs.ContentInfo.fromBER(container.slice().buffer as ArrayBuffer);

    if (contentInfo.contentType !== SIGNED_DATA_OID) {
        return [];
    }

    const signedData = new pkijs.SignedData({ schema: contentInfo.content });
    const certificates = (signedData.certificates ?? []).filter((certificate): certificate is pkijs.Certificate => certificate instanceof pkijs.Certificate);
    const signer = findSigner(signedData, certificates);

    if (signer === null) {
        return [];
    }

    return buildCertificateChain(signer, certificates, parsePemCertificate(policy.trustAnchorPem));
}

/** Pairs every certificate from the signer up to the anchor with the one that issued it. */
export function buildCertificateChain(signer: pkijs.Certificate, certificates: pkijs.Certificate[], anchor: pkijs.Certificate): CertificateAndIssuer[] {
    const chain: CertificateAndIssuer[] = [];
    const seen = new Set<pkijs.Certificate>();
    let certificate = signer;

    while (chain.length < MAXIMUM_CHAIN_LENGTH && !seen.has(certificate)) {
        seen.add(certificate);

        const issuer = [...certificates, anchor].find(candidate => candidate !== certificate && candidate.subject.isEqual(certificate.issuer));

        if (!issuer) {
            return [];
        }

        chain.push({ certificate, issuer, name: describe(certificate) });

        if (issuer === anchor || issuer.subject.isEqual(issuer.issuer)) {
            break;
        }

        certificate = issuer;
    }

    return chain;
}

function findSigner(signedData: pkijs.SignedData, certificates: pkijs.Certificate[]): pkijs.Certificate | null {
    const sid: unknown = signedData.signerInfos[0]?.sid;

    if (!(sid instanceof pkijs.IssuerAndSerialNumber)) {
        return null;
    }

    return certificates.find(certificate => certificate.issuer.isEqual(sid.issuer) && certificate.serialNumber.isEqual(sid.serialNumber)) ?? null;
}

function describe(certificate: pkijs.Certificate): string {
    return getSubjectAttribute(certificate, COMMON_NAME_OID) ?? 'unnamed certificate';
}
