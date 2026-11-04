import { SimpleError } from '@common/errors';
import * as asn1js from 'asn1js';
import * as pkijs from 'pkijs';

import { toArrayBuffer } from './Bytes.js';
import { checkSigningCertificateAttribute } from './EssSigningCertificate.js';
import { ORGANIZATION_IDENTIFIER_OID, getSpkiHash, getSubjectAttribute, isCertificateAuthority, parsePemCertificate } from './Certificates.js';
import { locatePdfSignature, unreadableSignature } from './PdfSignatureLocator.js';
import type { PdfSignaturePolicy } from './PdfSignaturePolicy.js';

const SIGNED_DATA_OID = '1.2.840.113549.1.7.2';
const DATA_OID = '1.2.840.113549.1.7.1';
const SIGNING_TIME_OID = '1.2.840.113549.1.9.5';
const CONTENT_TYPE_OID = '1.2.840.113549.1.9.3';

const SHA256_OID = '2.16.840.1.101.3.4.2.1'; // for the digest of the signed bytes
const SHA256_WITH_RSA_OID = '1.2.840.113549.1.1.11'; // for the signature over the signed attributes

/**
 * How far ahead of us a signing time may sit. The signer stamps it from its own clock, so a signature
 * made seconds ago can read as slightly future dated here; anything beyond this is not clock drift.
 */
const CLOCK_TOLERANCE_IN_MS = 5 * 60 * 1000;

function notSignedBy(signerName: string): string {
    return $t('Dit bestand werd niet ondertekend door {signerName}. Kijk na of je het juiste bestand koos.', { signerName });
}

function couldNotEstablishIssuer(signerName: string): string {
    return $t('We konden niet controleren of dit bestand van {signerName} komt.', { signerName });
}

/**
 * The one signing time the signed attributes hold, or null. Two of them is not a signing time: the
 * age of the document is judged on this, so a signature holding both an acceptable and an
 * unacceptable time must not pass on whichever comes first.
 */
function readSigningTime(signerInfo: pkijs.SignerInfo): Date | null {
    const attributes = (signerInfo.signedAttrs?.attributes ?? []).filter(attribute => attribute.type === SIGNING_TIME_OID);

    if (attributes.length !== 1 || attributes[0].values.length !== 1) {
        return null;
    }

    const value: unknown = attributes[0].values[0];

    if (value instanceof asn1js.UTCTime || value instanceof asn1js.GeneralizedTime) {
        return value.toDate();
    }

    return null;
}

/** The content type the signed attributes name, which is what the signer signed over. */
function readSignedContentType(signerInfo: pkijs.SignerInfo): string | null {
    for (const attribute of signerInfo.signedAttrs?.attributes ?? []) {
        if (attribute.type !== CONTENT_TYPE_OID) {
            continue;
        }

        const value: unknown = attribute.values[0];

        return value instanceof asn1js.ObjectIdentifier ? value.getValue() : null;
    }

    return null;
}

function findSignerCertificate(signedData: pkijs.SignedData, signerInfo: pkijs.SignerInfo): pkijs.Certificate | null {
    const sid: unknown = signerInfo.sid;

    if (!(sid instanceof pkijs.IssuerAndSerialNumber)) {
        return null;
    }

    const certificates = signedData.certificates ?? [];

    for (const certificate of certificates) {
        if (!(certificate instanceof pkijs.Certificate)) {
            continue;
        }

        if (certificate.issuer.isEqual(sid.issuer) && certificate.serialNumber.isEqual(sid.serialNumber)) {
            return certificate;
        }
    }

    return null;
}

/**
 * Verifies that `bytes` is an unmodified PDF digitally signed by the signer the policy pins.
 *
 * Establishes authenticity only: there is no revocation lookup, and the content of the document is
 * not parsed.
 *
 * Throws a `SimpleError` on every rejection.
 */
export async function verifyPdfSignature(bytes: Uint8Array, policy: PdfSignaturePolicy, maximumAgeInDays: number) {
    if (bytes.length > policy.maximumFileSize) {
        throw new SimpleError({
            code: 'file_too_large',
            message: `The file is ${bytes.length} bytes, the maximum is ${policy.maximumFileSize}.`,
            human: $t('Dit bestand is te groot om te controleren. Laad het originele pdf-bestand op dat je van {signerName} kreeg.', { signerName: policy.signerName }),
            statusCode: 400,
        });
    }

    const { container, signedBytes } = locatePdfSignature(bytes, policy.signerName);

    let signedData: pkijs.SignedData | undefined;
    let containerProblem: string | undefined;

    try {
        const contentInfo = pkijs.ContentInfo.fromBER(toArrayBuffer(container));

        if (contentInfo.contentType === SIGNED_DATA_OID) {
            signedData = new pkijs.SignedData({ schema: contentInfo.content });
        } else {
            containerProblem = `The signature container is ${contentInfo.contentType}, not CMS SignedData.`;
        }
    } catch (error) {
        containerProblem = error instanceof Error ? error.message : String(error);
    }

    if (signedData === undefined) {
        throw new SimpleError({
            code: 'malformed_signature_container',
            message: containerProblem ?? 'The /Contents entry does not parse as CMS SignedData.',
            human: unreadableSignature(policy.signerName),
            statusCode: 400,
        });
    }

    // A PDF signature is detached: what it covers is the byte range, and those bytes are never
    // carried inside the container. This has to be refused rather than tolerated, because pkijs
    // verifies `encapContentInfo.eContent` in place of the detached data it was handed whenever that
    // is present. An attached container would therefore name the bytes it is checked against itself,
    // which costs nothing to build: moving the bytes of a genuine document into its own container
    // leaves its signature valid over them, and the byte range would no longer constrain the
    // document at all.
    if (signedData.encapContentInfo.eContent !== undefined) {
        throw new SimpleError({
            code: 'signature_not_detached',
            message: 'The signature container carries attached content.',
            human: unreadableSignature(policy.signerName),
            statusCode: 400,
        });
    }

    if (signedData.encapContentInfo.eContentType !== DATA_OID) {
        throw new SimpleError({
            code: 'signature_not_detached',
            message: `The signature container covers ${signedData.encapContentInfo.eContentType}, not detached data.`,
            human: unreadableSignature(policy.signerName),
            statusCode: 400,
        });
    }

    if (signedData.signerInfos.length !== 1) {
        throw new SimpleError({
            code: 'multiple_signers',
            message: `The signature holds ${signedData.signerInfos.length} signers.`,
            human: $t('Dit bestand werd door meer dan één partij ondertekend. Laad het originele pdf-bestand op dat je van {signerName} kreeg.', { signerName: policy.signerName }),
            statusCode: 400,
        });
    }

    const signerInfo = signedData.signerInfos[0];

    if (signerInfo.digestAlgorithm.algorithmId !== SHA256_OID) {
        throw new SimpleError({
            code: 'unsupported_digest_algorithm',
            message: `The signature uses digest algorithm ${signerInfo.digestAlgorithm.algorithmId}, expected SHA-256.`,
            human: $t('De digitale ondertekening van dit bestand gebruikt een beveiliging die we niet aanvaarden. Laad het originele pdf-bestand op dat je van {signerName} kreeg.', { signerName: policy.signerName }),
            statusCode: 400,
        });
    }

    // Two separate hashes, so two separate checks. The digest algorithm above is the one the signed
    // bytes are reduced to; the hash the signature itself is made over comes from this OID instead,
    // and falls back to the digest algorithm only for bare `rsaEncryption` — so without this check a
    // container can name SHA-256 above and still be signed with SHA-1.
    if (signerInfo.signatureAlgorithm.algorithmId !== SHA256_WITH_RSA_OID) {
        throw new SimpleError({
            code: 'unsupported_signature_algorithm',
            message: `The signature uses signature algorithm ${signerInfo.signatureAlgorithm.algorithmId}, expected sha256WithRSAEncryption.`,
            human: $t('De digitale ondertekening van dit bestand gebruikt een beveiliging die we niet aanvaarden. Laad het originele pdf-bestand op dat je van {signerName} kreeg.', { signerName: policy.signerName }),
            statusCode: 400,
        });
    }

    const signedAt = readSigningTime(signerInfo);

    if (signedAt === null) {
        throw new SimpleError({
            code: 'missing_signing_time',
            message: 'The signature does not carry exactly one signing time.',
            human: unreadableSignature(policy.signerName),
            statusCode: 400,
        });
    }

    const signerCertificate = findSignerCertificate(signedData, signerInfo);

    if (signerCertificate === null) {
        throw new SimpleError({
            code: 'malformed_signature_container',
            message: 'The signer certificate is not embedded in the signature.',
            human: unreadableSignature(policy.signerName),
            statusCode: 400,
        });
    }

    // The signature itself, over exactly the bytes the byte range covers.
    let signatureVerified: boolean;

    try {
        const verified = await signedData.verify({
            signer: 0,
            data: toArrayBuffer(signedBytes),
            checkChain: false,
            extendedMode: true,
        });

        signatureVerified = verified.signatureVerified === true;
    } catch {
        signatureVerified = false;
    }

    if (!signatureVerified) {
        throw new SimpleError({
            code: 'invalid_signature',
            message: 'The signature does not match the signed bytes.',
            human: $t('De digitale ondertekening van dit bestand klopt niet. Laad het originele pdf-bestand op dat je van {signerName} kreeg, zonder het opnieuw op te slaan of te bewerken.', { signerName: policy.signerName }),
            statusCode: 400,
        });
    }

    // pkijs insists the content type attribute is present, never that it names what the container
    // says it covers. CAdES requires the two to agree, and for good reason: a signature made over one
    // kind of content must not be read as a signature over another.
    const signedContentType = readSignedContentType(signerInfo);

    if (signedContentType !== DATA_OID) {
        throw new SimpleError({
            code: 'unexpected_signed_content_type',
            message: `The signed content type attribute is ${signedContentType ?? 'missing'}, expected ${DATA_OID}.`,
            human: unreadableSignature(policy.signerName),
            statusCode: 400,
        });
    }

    // CAdES binds a signature to its signer certificate with this attribute, which is what stops the
    // embedded certificate being swapped for another one holding the same public key.
    if (await checkSigningCertificateAttribute(signerInfo, signerCertificate) === 'does_not_match') {
        throw new SimpleError({
            code: 'unexpected_signing_certificate',
            message: 'The signing-certificate attribute does not name the certificate the signature was verified with.',
            human: unreadableSignature(policy.signerName),
            statusCode: 400,
        });
    }

    // Only now that the signature holds are the signed attributes worth believing, so this is where
    // the signing time they carry can be judged.
    const now = new Date();

    if (signedAt.getTime() > now.getTime() + CLOCK_TOLERANCE_IN_MS) {
        throw new SimpleError({
            code: 'signed_in_the_future',
            message: `The signature claims to be made at ${signedAt.toISOString()}, which is after ${now.toISOString()}.`,
            human: $t('Volgens de digitale ondertekening werd dit bestand in de toekomst ondertekend. Laad het originele pdf-bestand op dat je van {signerName} kreeg.', { signerName: policy.signerName }),
            statusCode: 400,
        });
    }

    if (signedAt.getTime() < now.getTime() - maximumAgeInDays * 24 * 60 * 60 * 1000) {
        throw new SimpleError({
            code: 'signature_too_old',
            message: `The signature was made at ${signedAt.toISOString()}, more than ${maximumAgeInDays} days before ${now.toISOString()}.`,
            human: $t('Dit bestand werd te lang geleden ondertekend. Vraag een recenter document aan bij {signerName} en laad dat op.', { signerName: policy.signerName }),
            statusCode: 400,
        });
    }

    // The signer has to have held a valid certificate at the moment it signed. Taking the signing
    // time rather than today keeps an extract verifiable after the certificate expires, which it
    // should be: it was authentic when it was issued.
    if (signedAt < signerCertificate.notBefore.value || signedAt > signerCertificate.notAfter.value) {
        throw new SimpleError({
            code: 'certificate_expired_at_signing_time',
            message: `The signer certificate was valid from ${signerCertificate.notBefore.value.toISOString()} until ${signerCertificate.notAfter.value.toISOString()}, but the signature claims ${signedAt.toISOString()}.`,
            human: couldNotEstablishIssuer(policy.signerName),
            statusCode: 400,
        });
    }

    const certificates = (signedData.certificates ?? []).filter((certificate): certificate is pkijs.Certificate => certificate instanceof pkijs.Certificate);
    const anchor = parsePemCertificate(policy.trustAnchorPem);
    const anchorHash = await getSpkiHash(anchor);

    if (anchorHash !== policy.trustAnchorSpkiHash) {
        // The bundled PEM and its pin disagree, so one of the two was edited. Refuse rather than
        // trust whichever happens to be in the file.
        throw new SimpleError({
            code: 'untrusted_certificate_chain',
            message: `The bundled trust anchor hashes to ${anchorHash}, but ${policy.trustAnchorSpkiHash} is pinned.`,
            human: couldNotEstablishIssuer(policy.signerName),
            statusCode: 400,
        });
    }

    // The validation engine treats the last entry as the certificate to validate.
    const engine = new pkijs.CertificateChainValidationEngine({
        trustedCerts: [anchor],
        certs: [...certificates.filter(certificate => certificate !== signerCertificate), signerCertificate],
        checkDate: signedAt,
    });

    let validated: Awaited<ReturnType<typeof engine.verify>> | null = null;
    let validationError: string | null = null;

    try {
        validated = await engine.verify();
    } catch (error) {
        validationError = error instanceof Error ? error.message : String(error);
    }

    if (validated === null || !validated.result) {
        throw new SimpleError({
            code: 'untrusted_certificate_chain',
            message: validationError ?? validated?.resultMessage ?? 'The certificate chain does not validate to the pinned trust anchor.',
            human: couldNotEstablishIssuer(policy.signerName),
            statusCode: 400,
        });
    }

    const path = validated.certificatePath ?? [];

    if (path.length < 2 || path[0] !== signerCertificate) {
        throw new SimpleError({
            code: 'untrusted_certificate_chain',
            message: 'The validated certificate path does not start at the signer.',
            human: couldNotEstablishIssuer(policy.signerName),
            statusCode: 400,
        });
    }

    const pathHashes = await Promise.all(path.map(certificate => getSpkiHash(certificate)));

    if (pathHashes[pathHashes.length - 1] !== policy.trustAnchorSpkiHash) {
        throw new SimpleError({
            code: 'untrusted_certificate_chain',
            message: 'The validated certificate path does not end at the pinned trust anchor.',
            human: couldNotEstablishIssuer(policy.signerName),
            statusCode: 400,
        });
    }

    // Sorted rather than by membership: the pinned set is the exact set of intermediates the path has
    // to run through, so one of them appearing twice in place of another is not the pinned set.
    const intermediates = pathHashes.slice(1, -1).sort();
    const expected = [...policy.intermediateSpkiHashes].sort();

    if (intermediates.length !== expected.length || intermediates.some((hash, index) => hash !== expected[index])) {
        throw new SimpleError({
            code: 'unexpected_certificate_chain',
            message: `The path runs through ${intermediates.length > 0 ? intermediates.join(', ') : 'no intermediates'}, which is not the pinned set. A certificate authority rotation looks like this.`,
            human: couldNotEstablishIssuer(policy.signerName),
            statusCode: 400,
        });
    }

    // A certificate authority signs certificates, never documents. The pinned intermediate set makes
    // this unreachable today — the one CA that may issue here is a dedicated document signing CA — so
    // this is about the question being asked at all: nothing above establishes that the validated path
    // ends at an end entity, and a path that happens to end at a CA would otherwise be accepted.
    if (isCertificateAuthority(signerCertificate)) {
        throw new SimpleError({
            code: 'signer_is_certificate_authority',
            message: 'The signer certificate is a certificate authority, not an end entity.',
            human: notSignedBy(policy.signerName),
            statusCode: 400,
        });
    }

    const organizationIdentifier = getSubjectAttribute(signerCertificate, ORGANIZATION_IDENTIFIER_OID);

    if (organizationIdentifier !== policy.signerOrganizationIdentifier) {
        throw new SimpleError({
            code: 'unexpected_signer',
            message: `The signer's organization identifier is ${organizationIdentifier ?? 'missing or not unique'}, expected ${policy.signerOrganizationIdentifier}.`,
            human: notSignedBy(policy.signerName),
            statusCode: 400,
        });
    }
}
