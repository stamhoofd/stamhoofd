import * as asn1js from 'asn1js';
import * as pkijs from 'pkijs';

import { toArrayBuffer } from '../Bytes.js';
import { encodeBase64, getSpkiHash } from '../Certificates.js';
import type { PdfSignaturePolicy } from '../PdfSignaturePolicy.js';

/**
 * Builds certificates and correctly signed PDFs at test time. A real extract holds someone's name,
 * birth date and address, so one is never committed here; a synthetic chain under a synthetic anchor
 * exercises every path instead, the happy one included.
 *
 * This lives in `src` rather than beside the tests because the package that wraps this one needs the
 * same signed pdfs to test the revocation lookup it adds.
 */

const KEY_ALGORITHM = {
    name: 'RSASSA-PKCS1-v1_5',
    hash: 'SHA-256',
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
};

const CONTENT_TYPE_ATTRIBUTE_OID = '1.2.840.113549.1.9.3';
const SIGNING_TIME_ATTRIBUTE_OID = '1.2.840.113549.1.9.5';
const MESSAGE_DIGEST_ATTRIBUTE_OID = '1.2.840.113549.1.9.4';
const SIGNING_CERTIFICATE_V2_ATTRIBUTE_OID = '1.2.840.113549.1.9.16.2.47';
const AUTHORITY_INFO_ACCESS_OID = '1.3.6.1.5.5.7.1.1';
const OCSP_ACCESS_METHOD_OID = '1.3.6.1.5.5.7.48.1';
const URI_GENERAL_NAME = 6;
const DATA_OID = '1.2.840.113549.1.7.1';
const SIGNED_DATA_OID = '1.2.840.113549.1.7.2';

export interface TestCertificate {
    certificate: pkijs.Certificate;
    privateKey: CryptoKey;
    publicKey: CryptoKey;
}

function distinguishedName(entries: [string, string][]): pkijs.RelativeDistinguishedNames {
    const name = new pkijs.RelativeDistinguishedNames();

    for (const [type, value] of entries) {
        name.typesAndValues.push(new pkijs.AttributeTypeAndValue({ type, value: new asn1js.Utf8String({ value }) }));
    }

    return name;
}

let nextSerialNumber = 1;

export async function issueCertificate(options: {
    subject: [string, string][];
    issuer?: TestCertificate;
    notBefore?: Date;
    notAfter?: Date;
    isCertificateAuthority?: boolean;
    /** Issue this certificate on an existing key pair, so two certificates share one public key. */
    reuseKeysOf?: TestCertificate;
    /**
     * Where to ask whether this certificate is still valid. Only the package that adds the
     * revocation lookup on top of this one needs it: a certificate that says nowhere to ask leaves
     * every status unestablished, so its own verification cannot be run over a chain built here
     * without one.
     */
    ocspUrl?: string;
}): Promise<TestCertificate> {
    const crypto = pkijs.getCrypto(true);
    const keys = options.reuseKeysOf === undefined
        ? await crypto.generateKey(KEY_ALGORITHM, true, ['sign', 'verify'])
        : { privateKey: options.reuseKeysOf.privateKey, publicKey: options.reuseKeysOf.publicKey };

    const certificate = new pkijs.Certificate();
    certificate.version = 2;
    certificate.serialNumber = new asn1js.Integer({ value: nextSerialNumber++ });
    certificate.subject = distinguishedName(options.subject);
    certificate.issuer = options.issuer ? options.issuer.certificate.subject : certificate.subject;
    certificate.notBefore.value = options.notBefore ?? new Date('2020-01-01T00:00:00Z');
    certificate.notAfter.value = options.notAfter ?? new Date('2040-01-01T00:00:00Z');
    certificate.extensions = [
        new pkijs.Extension({
            extnID: '2.5.29.19',
            critical: true,
            extnValue: new pkijs.BasicConstraints({ cA: options.isCertificateAuthority ?? false }).toSchema().toBER(false),
        }),
    ];

    if (options.ocspUrl !== undefined) {
        certificate.extensions.push(new pkijs.Extension({
            extnID: AUTHORITY_INFO_ACCESS_OID,
            critical: false,
            extnValue: new pkijs.InfoAccess({
                accessDescriptions: [new pkijs.AccessDescription({
                    accessMethod: OCSP_ACCESS_METHOD_OID,
                    accessLocation: new pkijs.GeneralName({ type: URI_GENERAL_NAME, value: options.ocspUrl }),
                })],
            }).toSchema().toBER(false),
        }));
    }

    await certificate.subjectPublicKeyInfo.importKey(keys.publicKey, crypto);
    await certificate.sign(options.issuer ? options.issuer.privateKey : keys.privateKey, 'SHA-256', crypto);

    return { certificate, privateKey: keys.privateKey, publicKey: keys.publicKey };
}

export function toPem(certificate: pkijs.Certificate): string {
    const base64 = encodeBase64(new Uint8Array(certificate.toSchema(true).toBER(false)));
    const lines = base64.match(/.{1,64}/g) ?? [];

    return `-----BEGIN CERTIFICATE-----\n${lines.join('\n')}\n-----END CERTIFICATE-----\n`;
}

/** The chain a test uses: an anchor, one intermediate, and a signer the policy accepts. */
export interface TestChain {
    anchor: TestCertificate;
    intermediate: TestCertificate;
    signer: TestCertificate;
    policy: PdfSignaturePolicy;
}

export const TEST_SIGNER_ORGANIZATION = 'Signing Authority nv';
export const TEST_SIGNER_ORGANIZATION_IDENTIFIER = 'VATBE-0123456789';
export const TEST_SIGNER_COMMON_NAME = 'Signing Authority - Document Service';
export const TEST_SIGNER_NAME = 'Signing Authority';

export async function createTestChain(options: {
    signerNotBefore?: Date;
    signerNotAfter?: Date;
    /** Per certificate, since a responder answers about one of them at a time. */
    signerOcspUrl?: string;
    intermediateOcspUrl?: string;
} = {}): Promise<TestChain> {
    const anchor = await issueCertificate({
        subject: [['2.5.4.3', 'Test Document Signing Root'], ['2.5.4.10', 'Test nv-sa']],
        isCertificateAuthority: true,
    });

    const intermediate = await issueCertificate({
        subject: [['2.5.4.3', 'Test AATL CA'], ['2.5.4.10', 'Test nv-sa']],
        issuer: anchor,
        isCertificateAuthority: true,
        ocspUrl: options.intermediateOcspUrl,
    });

    const signer = await issueCertificate({
        subject: [
            ['2.5.4.3', TEST_SIGNER_COMMON_NAME],
            ['2.5.4.10', TEST_SIGNER_ORGANIZATION],
            ['2.5.4.97', TEST_SIGNER_ORGANIZATION_IDENTIFIER],
        ],
        issuer: intermediate,
        notBefore: options.signerNotBefore,
        notAfter: options.signerNotAfter,
        ocspUrl: options.signerOcspUrl,
    });

    return {
        anchor,
        intermediate,
        signer,
        policy: {
            signerName: TEST_SIGNER_NAME,
            signerOrganizationIdentifier: TEST_SIGNER_ORGANIZATION_IDENTIFIER,
            trustAnchorPem: toPem(anchor.certificate),
            trustAnchorSpkiHash: await getSpkiHash(anchor.certificate),
            intermediateSpkiHashes: [await getSpkiHash(intermediate.certificate)],
            maximumFileSize: 10 * 1024 * 1024,
        },
    };
}

const PLACEHOLDER_HEX_LENGTH = 16000;

function padOffset(value: number): string {
    return String(value).padStart(10, '0');
}

function assemble(options: { byteRange: number[]; contentsHex: string }): {
    text: string;
    contentsStart: number;
} {
    const head = [
        '%PDF-1.7\n',
        '1 0 obj\n<< /Type /Catalog /Pages 2 0 R /AcroForm << /Fields [4 0 R] /SigFlags 3 >> >>\nendobj\n',
        '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
        '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] >>\nendobj\n',
        '4 0 obj\n<< /Type /Annot /Subtype /Widget /FT /Sig /T (Signature1) /Rect [0 0 0 0] /V 5 0 R >>\nendobj\n',
    ].join('');
    const prefix = `5 0 obj\n<< /Type /Sig /Filter /Adobe.PPKLite /SubFilter /ETSI.CAdES.detached /ByteRange [${options.byteRange.map(padOffset).join(' ')}] /Contents <`;
    const suffix = '>\n>>\nendobj\n';
    const trailer = 'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n0\n%%EOF\n';

    return {
        text: head + prefix + options.contentsHex + suffix + trailer,
        contentsStart: head.length + prefix.length - 1,
    };
}

export interface SignedPdfOptions {
    chain: TestChain;
    signedAt?: Date;
    /** Leave out the signing time attribute. */
    withoutSigningTime?: boolean;
    /** Sign with a key whose certificate is not in `chain`, so the chain does not validate. */
    signWith?: TestCertificate;
    /** Certificates to embed instead of the real chain. */
    embedCertificates?: pkijs.Certificate[];
    /** Overwrite the signature algorithm OID the container names, leaving the signature itself alone. */
    signatureAlgorithm?: string;
    /** Overwrite the digest algorithm OID the container names, leaving the signature itself alone. */
    digestAlgorithm?: string;
    /**
     * Copy the signed bytes into the container as attached `eContent`, on top of the detached
     * signature. The signer info, the signed attributes and the signature itself stay untouched, so
     * the container still carries a genuine detached signature; it just also holds the bytes that
     * signature was made over. This is the container a forger can build out of any genuine
     * document, without its signer's key.
     */
    attachSignedContent?: boolean;
    /** Overwrite the content type the signed attributes name, leaving the container's own alone. */
    contentTypeAttributeOid?: string;
    /** Add a `signing-certificate-v2` signed attribute naming this certificate. */
    signingCertificate?: pkijs.Certificate;
    /** Overwrite the content type the container says it covers, leaving the signature alone. */
    eContentType?: string;
    /** Repeat the signer info, so the container names two signers over one signature. */
    twoSigners?: boolean;
    /** Name the signer by the hash of its public key instead of by issuer and serial number. */
    useSubjectKeyIdentifier?: boolean;
    /** Add a second signing time attribute, holding this date beside the first. */
    secondSignedAt?: Date;
}

/** `SigningCertificateV2 ::= SEQUENCE { certs SEQUENCE OF ESSCertIDv2 }`, hashed with the default SHA-256. */
async function signingCertificateV2Attribute(certificate: pkijs.Certificate): Promise<pkijs.Attribute> {
    const der = new Uint8Array(certificate.toSchema().toBER(false));
    const certHash = await pkijs.getCrypto(true).digest('SHA-256', toArrayBuffer(der));

    return new pkijs.Attribute({
        type: SIGNING_CERTIFICATE_V2_ATTRIBUTE_OID,
        values: [new asn1js.Sequence({
            value: [new asn1js.Sequence({
                value: [new asn1js.Sequence({ value: [new asn1js.OctetString({ valueHex: certHash })] })],
            })],
        })],
    });
}

/**
 * Builds a one page PDF with a single detached CAdES signature over the whole file. The byte range
 * and the `/Contents` placeholder have a fixed width, so filling in the real values cannot shift any
 * offset — the same two pass trick a signing library uses.
 */
export async function createSignedPdf(options: SignedPdfOptions): Promise<Uint8Array> {
    const crypto = pkijs.getCrypto(true);
    const encoder = new TextEncoder();
    const signWith = options.signWith ?? options.chain.signer;
    const placeholder = '0'.repeat(PLACEHOLDER_HEX_LENGTH);

    const measured = assemble({ contentsHex: placeholder, byteRange: [0, 0, 0, 0] });
    const contentsEnd = measured.contentsStart + PLACEHOLDER_HEX_LENGTH + 2;
    const byteRange = [0, measured.contentsStart, contentsEnd, measured.text.length - contentsEnd];

    const unsigned = assemble({ contentsHex: placeholder, byteRange });

    if (unsigned.text.length !== measured.text.length) {
        throw new Error('The byte range placeholder changed the length of the document');
    }

    const bytes = encoder.encode(unsigned.text);
    const signedBytes = new Uint8Array(byteRange[1] + byteRange[3]);
    signedBytes.set(bytes.subarray(0, byteRange[1]), 0);
    signedBytes.set(bytes.subarray(byteRange[2], byteRange[2] + byteRange[3]), byteRange[1]);
    const signedBuffer = toArrayBuffer(signedBytes);

    const subjectKeyIdentifier = options.useSubjectKeyIdentifier === true
        ? await crypto.digest({ name: 'sha-1' }, toArrayBuffer(signWith.certificate.subjectPublicKeyInfo.subjectPublicKey.valueBlock.valueHexView))
        : null;

    const signedData = new pkijs.SignedData({
        version: 1,
        encapContentInfo: new pkijs.EncapsulatedContentInfo({ eContentType: DATA_OID }),
        signerInfos: [
            new pkijs.SignerInfo({
                // `[0] IMPLICIT SubjectKeyIdentifier`, the other of the two ways CMS names a signer.
                version: subjectKeyIdentifier === null ? 1 : 3,
                sid: subjectKeyIdentifier === null
                    ? new pkijs.IssuerAndSerialNumber({
                            issuer: signWith.certificate.issuer,
                            serialNumber: signWith.certificate.serialNumber,
                        })
                    : new asn1js.Primitive({ idBlock: { tagClass: 3, tagNumber: 0 }, valueHex: subjectKeyIdentifier }),
            }),
        ],
        certificates: options.embedCertificates ?? [
            signWith.certificate,
            options.chain.intermediate.certificate,
            options.chain.anchor.certificate,
        ],
    });

    const attributes = [
        new pkijs.Attribute({ type: CONTENT_TYPE_ATTRIBUTE_OID, values: [new asn1js.ObjectIdentifier({ value: options.contentTypeAttributeOid ?? DATA_OID })] }),
        new pkijs.Attribute({ type: MESSAGE_DIGEST_ATTRIBUTE_OID, values: [new asn1js.OctetString({ valueHex: await crypto.digest('SHA-256', signedBuffer) })] }),
    ];

    if (options.signingCertificate !== undefined) {
        attributes.push(await signingCertificateV2Attribute(options.signingCertificate));
    }

    if (options.withoutSigningTime !== true) {
        attributes.push(new pkijs.Attribute({
            type: SIGNING_TIME_ATTRIBUTE_OID,
            values: [new asn1js.UTCTime({ valueDate: options.signedAt ?? new Date('2026-11-02T17:02:46Z') })],
        }));
    }

    if (options.secondSignedAt !== undefined) {
        attributes.push(new pkijs.Attribute({
            type: SIGNING_TIME_ATTRIBUTE_OID,
            values: [new asn1js.UTCTime({ valueDate: options.secondSignedAt })],
        }));
    }

    signedData.signerInfos[0].signedAttrs = new pkijs.SignedAndUnsignedAttributes({ type: 0, attributes });

    await signedData.sign(signWith.privateKey, 0, 'SHA-256', signedBuffer, crypto);

    if (options.digestAlgorithm !== undefined) {
        signedData.signerInfos[0].digestAlgorithm.algorithmId = options.digestAlgorithm;
    }

    if (options.signatureAlgorithm !== undefined) {
        signedData.signerInfos[0].signatureAlgorithm.algorithmId = options.signatureAlgorithm;
    }

    if (options.eContentType !== undefined) {
        signedData.encapContentInfo.eContentType = options.eContentType;
    }

    if (options.twoSigners === true) {
        signedData.signerInfos.push(signedData.signerInfos[0]);
    }

    if (options.attachSignedContent === true) {
        // After signing, so the signature and the signed attributes are the detached ones.
        signedData.encapContentInfo.eContent = new asn1js.OctetString({ valueHex: signedBuffer });
    }

    const container = new Uint8Array(new pkijs.ContentInfo({ contentType: SIGNED_DATA_OID, content: signedData.toSchema(true) }).toSchema().toBER(false));
    let hex = '';

    for (const byte of container) {
        hex += byte.toString(16).padStart(2, '0');
    }

    if (hex.length > PLACEHOLDER_HEX_LENGTH) {
        throw new Error('The signature does not fit in the placeholder');
    }

    const signed = assemble({ byteRange, contentsHex: hex.padEnd(PLACEHOLDER_HEX_LENGTH, '0') });

    return encoder.encode(signed.text);
}
