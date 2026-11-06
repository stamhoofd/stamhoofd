import * as pkijs from 'pkijs';

import { toArrayBuffer } from './Bytes.js';

export const ORGANIZATION_IDENTIFIER_OID = '2.5.4.97';
export const BASIC_CONSTRAINTS_OID = '2.5.29.19';

export function decodeBase64(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }

    return bytes;
}

export function encodeBase64(bytes: Uint8Array): string {
    let binary = '';

    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }

    return btoa(binary);
}

export function parsePemCertificate(pem: string): pkijs.Certificate {
    const base64 = pem.replace(/-----[^-]*-----/g, '').replace(/\s+/g, '');

    return pkijs.Certificate.fromBER(toArrayBuffer(decodeBase64(base64)));
}

export async function getSpkiHash(certificate: pkijs.Certificate): Promise<string> {
    const spki = new Uint8Array(certificate.subjectPublicKeyInfo.toSchema().toBER(false));
    const digest = await pkijs.getCrypto(true).digest('SHA-256', toArrayBuffer(spki));

    return encodeBase64(new Uint8Array(digest));
}

/** Whether the certificate says it is a certificate authority. */
export function isCertificateAuthority(certificate: pkijs.Certificate): boolean {
    for (const extension of certificate.extensions ?? []) {
        if (extension.extnID !== BASIC_CONSTRAINTS_OID) {
            continue;
        }

        const parsed: unknown = extension.parsedValue;

        if (!(parsed instanceof pkijs.BasicConstraints)) {
            return true;
        }

        if ('parsingError' in parsed && typeof parsed.parsingError === 'string') {
            return true;
        }

        if (parsed.cA === true) {
            return true;
        }
    }

    return false;
}

/**
 * The one value the subject holds for this attribute, or null. A subject that names the attribute
 * twice has no single answer, so it gets none: taking the first of two would let the value this is
 * compared against sit beside another the comparison never sees.
 */
export function getSubjectAttribute(certificate: pkijs.Certificate, oid: string): string | null {
    const attributes = certificate.subject.typesAndValues.filter(entry => entry.type === oid);

    if (attributes.length !== 1) {
        return null;
    }

    const value: unknown = attributes[0].value.valueBlock.value;

    return typeof value === 'string' ? value : null;
}
