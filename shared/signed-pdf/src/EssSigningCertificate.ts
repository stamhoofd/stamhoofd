import * as asn1js from 'asn1js';
import * as pkijs from 'pkijs';

import { toArrayBuffer } from './Bytes.js';

/** `signing-certificate`, RFC 5035. Its `ESSCertID` always hashes with SHA-1. */
const SIGNING_CERTIFICATE_OID = '1.2.840.113549.1.9.16.2.12';

/** `signing-certificate-v2`, RFC 5035. Its `ESSCertIDv2` names its own hash, SHA-256 by default. */
const SIGNING_CERTIFICATE_V2_OID = '1.2.840.113549.1.9.16.2.47';

const SHA1_OID = '1.3.14.3.2.26';
const SHA256_OID = '2.16.840.1.101.3.4.2.1';
const SHA384_OID = '2.16.840.1.101.3.4.2.2';
const SHA512_OID = '2.16.840.1.101.3.4.2.3';

const DIGEST_NAMES = new Map([
    [SHA1_OID, 'SHA-1'],
    [SHA256_OID, 'SHA-256'],
    [SHA384_OID, 'SHA-384'],
    [SHA512_OID, 'SHA-512'],
]);

export type SigningCertificateBinding = 'absent' | 'matches' | 'does_not_match';

function readObjectIdentifier(value: unknown): string | null {
    if (!(value instanceof asn1js.Sequence)) {
        return null;
    }

    const algorithm: unknown = value.valueBlock.value[0];

    return algorithm instanceof asn1js.ObjectIdentifier ? algorithm.getValue() : null;
}

/** The `certHash` of the first `ESSCertID` in the attribute, and the hash it was made with. */
function readFirstCertificateHash(attributeValue: unknown, isVersion2: boolean): { digestName: string; certificateHash: Uint8Array } | null {
    if (!(attributeValue instanceof asn1js.Sequence)) {
        return null;
    }

    const certs: unknown = attributeValue.valueBlock.value[0];

    if (!(certs instanceof asn1js.Sequence)) {
        return null;
    }

    const first: unknown = certs.valueBlock.value[0];

    if (!(first instanceof asn1js.Sequence)) {
        return null;
    }

    const fields = first.valueBlock.value;

    // `ESSCertIDv2` opens with an optional hash algorithm, left out when it is SHA-256; `ESSCertID`
    // has no such field and is always SHA-1. Either way the hash itself follows it.
    const hasAlgorithm = fields[0] instanceof asn1js.Sequence;
    const digestName = hasAlgorithm ? DIGEST_NAMES.get(readObjectIdentifier(fields[0]) ?? '') : (isVersion2 ? 'SHA-256' : 'SHA-1');
    const certificateHash: unknown = fields[hasAlgorithm ? 1 : 0];

    if (digestName === undefined || !(certificateHash instanceof asn1js.OctetString)) {
        return null;
    }

    return { digestName, certificateHash: certificateHash.valueBlock.valueHexView };
}

/**
 * Checks the `signing-certificate(-v2)` signed attribute against the certificate the signature was
 * verified with. The attribute is CAdES' binding between a signature and its signer certificate: it
 * carries a hash of that certificate, so swapping the embedded certificate for another one holding
 * the same public key is caught.
 *
 * Absence is reported rather than refused. The attribute lives among the *signed* attributes, so it
 * cannot be dropped from a signature that carried one without breaking that signature — which makes
 * refusing a signature that never had one a compatibility risk with no security to show for it.
 *
 * Anything unreadable reads as `does_not_match`: an attribute that is there and cannot be checked is
 * not an attribute that passed.
 */
export async function checkSigningCertificateAttribute(signerInfo: pkijs.SignerInfo, signerCertificate: pkijs.Certificate): Promise<SigningCertificateBinding> {
    for (const attribute of signerInfo.signedAttrs?.attributes ?? []) {
        if (attribute.type !== SIGNING_CERTIFICATE_OID && attribute.type !== SIGNING_CERTIFICATE_V2_OID) {
            continue;
        }

        const claimed = readFirstCertificateHash(attribute.values[0], attribute.type === SIGNING_CERTIFICATE_V2_OID);

        if (claimed === null) {
            return 'does_not_match';
        }

        const certificate = new Uint8Array(signerCertificate.toSchema().toBER(false));
        const digest = new Uint8Array(await pkijs.getCrypto(true).digest(claimed.digestName, toArrayBuffer(certificate)));

        if (digest.length !== claimed.certificateHash.length) {
            return 'does_not_match';
        }

        for (let i = 0; i < digest.length; i++) {
            if (digest[i] !== claimed.certificateHash[i]) {
                return 'does_not_match';
            }
        }

        return 'matches';
    }

    return 'absent';
}
