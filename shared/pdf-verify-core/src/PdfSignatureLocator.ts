import { SimpleError } from '@common/errors';

import { decodeAscii, decodeHex, indexesOfAscii, isPdfWhitespace, startsWithAscii } from './Bytes.js';

/** The detached CMS sub filters we verify. An attached or timestamp-only signature is rejected. */
const SUPPORTED_SUB_FILTERS = ['ETSI.CAdES.detached', 'adbe.pkcs7.detached'];

export interface LocatedPdfSignature {
    /** `[offset, length, offset, length]`, exactly as the signature dictionary holds it. */
    byteRange: readonly [number, number, number, number];

    /** The DER encoded CMS taken from `/Contents`. */
    container: Uint8Array;

    /** The two byte ranges concatenated: precisely the bytes the signature covers. */
    signedBytes: Uint8Array;

    subFilter: string;
}

export function unreadableSignature(signerName: string): string {
    return $t('De digitale ondertekening van dit bestand is onleesbaar. Laad het originele pdf-bestand op dat je van {signerName} kreeg, zonder het opnieuw op te slaan of te bewerken.', { signerName });
}

function changedAfterSigning(signerName: string): string {
    return $t('Dit bestand werd gewijzigd nadat {signerName} het ondertekende. Laad het originele pdf-bestand op dat je van {signerName} kreeg, zonder het opnieuw op te slaan of te bewerken.', { signerName });
}

/** Reads `[ a b c d ]` of non-negative integers, starting at the `[`. */
function readByteRange(bytes: Uint8Array, at: number): readonly [number, number, number, number] | null {
    let i = at;

    while (isPdfWhitespace(bytes[i])) {
        i++;
    }

    if (bytes[i] !== 0x5b) {
        return null;
    }

    i++;
    const numbers: number[] = [];

    for (;;) {
        while (isPdfWhitespace(bytes[i])) {
            i++;
        }

        if (bytes[i] === 0x5d) {
            break;
        }

        const start = i;

        while (bytes[i] !== undefined && bytes[i] >= 0x30 && bytes[i] <= 0x39) {
            i++;
        }

        if (i === start || numbers.length === 4) {
            return null;
        }

        numbers.push(Number(decodeAscii(bytes, start, i)));
    }

    if (numbers.length !== 4 || numbers.some(number => !Number.isSafeInteger(number))) {
        return null;
    }

    return [numbers[0], numbers[1], numbers[2], numbers[3]];
}

/** Reads a PDF name such as `ETSI.CAdES.detached`, from the whitespace before its `/`. */
function readName(bytes: Uint8Array, from: number): string | null {
    let at = from;

    while (isPdfWhitespace(bytes[at])) {
        at++;
    }

    if (bytes[at] !== 0x2f) {
        return null;
    }

    let end = at + 1;

    while (end < bytes.length && !isPdfWhitespace(bytes[end]) && bytes[end] !== 0x2f && bytes[end] !== 0x3e && bytes[end] !== 0x5b && bytes[end] !== 0x5d) {
        end++;
    }

    return end === at + 1 ? null : decodeAscii(bytes, at + 1, end);
}

/**
 * Finds the one signature in the file and the bytes it covers, by scanning for the signature
 * dictionary rather than by parsing the document. A signature dictionary's `/ByteRange` and
 * `/Contents` have to be direct, uncompressed objects — they describe file offsets — so scanning
 * finds all of them, and keeping a PDF parser out of the path keeps the browser bundle small and
 * exposes far less code to an untrusted file.
 *
 * Coverage is the central check: the two signed ranges must end exactly at the end of the file, and
 * the gap between them must be exactly the `/Contents` hex span. Together that means nothing was
 * appended, removed or changed after signing, an incremental update included.
 *
 * Throws a `SimpleError` when the file carries no usable signature.
 */
export function locatePdfSignature(bytes: Uint8Array, signerName: string): LocatedPdfSignature {
    if (!startsWithAscii(bytes, '%PDF-', 0)) {
        throw new SimpleError({
            code: 'not_a_pdf',
            message: 'The file does not start with a PDF header.',
            human: $t('Dit bestand is geen pdf. Laad het originele pdf-bestand op dat je van {signerName} kreeg.', { signerName }),
            statusCode: 400,
        });
    }

    const byteRangeKeys = indexesOfAscii(bytes, '/ByteRange');

    if (byteRangeKeys.length === 0) {
        throw new SimpleError({
            code: 'no_signature',
            message: 'The document holds no signature.',
            human: $t('Dit bestand is niet digitaal ondertekend. Een afdruk, een scan of een foto kan niet gecontroleerd worden. Laad het originele pdf-bestand op dat je van {signerName} kreeg.', { signerName }),
            statusCode: 400,
        });
    }

    if (byteRangeKeys.length > 1) {
        throw new SimpleError({
            code: 'multiple_signatures',
            message: `The document holds ${byteRangeKeys.length} signatures.`,
            human: $t('Dit bestand bevat meer dan één digitale ondertekening. Laad het originele pdf-bestand op dat je van {signerName} kreeg, zonder het opnieuw op te slaan of te bewerken.', { signerName }),
            statusCode: 400,
        });
    }

    const byteRange = readByteRange(bytes, byteRangeKeys[0] + '/ByteRange'.length);

    if (byteRange === null) {
        throw new SimpleError({
            code: 'malformed_signature_dictionary',
            message: 'The byte range of the signature could not be read.',
            human: unreadableSignature(signerName),
            statusCode: 400,
        });
    }

    const [firstOffset, firstLength, secondOffset, secondLength] = byteRange;

    if (firstOffset !== 0 || firstLength <= 0 || secondLength <= 0 || secondOffset <= firstLength) {
        throw new SimpleError({
            code: 'malformed_signature_dictionary',
            message: `The byte range of the signature is not usable: [${byteRange.join(' ')}].`,
            human: unreadableSignature(signerName),
            statusCode: 400,
        });
    }

    if (secondOffset + secondLength !== bytes.length) {
        throw new SimpleError({
            code: 'incomplete_coverage',
            message: `The signature covers ${secondOffset + secondLength} of ${bytes.length} bytes, so the document changed after signing.`,
            human: changedAfterSigning(signerName),
            statusCode: 400,
        });
    }

    // The gap between the two signed ranges is the `/Contents` hex string, brackets included: that is
    // the only part of the file a signature cannot cover, since it holds the signature itself.
    const gapStart = firstLength;
    const gapEnd = secondOffset;

    if (bytes[gapStart] !== 0x3c || bytes[gapEnd - 1] !== 0x3e) {
        throw new SimpleError({
            code: 'incomplete_coverage',
            message: 'The gap between the signed ranges is not the signature itself.',
            human: changedAfterSigning(signerName),
            statusCode: 400,
        });
    }

    let beforeGap = gapStart - 1;

    while (isPdfWhitespace(bytes[beforeGap])) {
        beforeGap--;
    }

    if (!startsWithAscii(bytes, '/Contents', beforeGap - '/Contents'.length + 1)) {
        throw new SimpleError({
            code: 'incomplete_coverage',
            message: 'The gap between the signed ranges is not a /Contents entry.',
            human: changedAfterSigning(signerName),
            statusCode: 400,
        });
    }

    const container = decodeHex(bytes, gapStart + 1, gapEnd - 1);

    if (container === null || container.length === 0) {
        throw new SimpleError({
            code: 'malformed_signature_dictionary',
            message: 'The /Contents entry of the signature is not a hexadecimal string.',
            human: unreadableSignature(signerName),
            statusCode: 400,
        });
    }

    const subFilterKeys = indexesOfAscii(bytes, '/SubFilter');

    // Only one occurrence is allowed to avoid ambiguity
    if (subFilterKeys.length > 1) {
        throw new SimpleError({
            code: 'multiple_signatures',
            message: `The document holds ${subFilterKeys.length} signature formats.`,
            human: $t('Dit bestand bevat meer dan één digitale ondertekening. Laad het originele pdf-bestand op dat je van {signerName} kreeg, zonder het opnieuw op te slaan of te bewerken.', { signerName }),
            statusCode: 400,
        });
    }

    const subFilter = subFilterKeys.length === 0 ? null : readName(bytes, subFilterKeys[0] + '/SubFilter'.length);

    if (subFilter === null) {
        throw new SimpleError({
            code: 'malformed_signature_dictionary',
            message: 'The signature has no readable /SubFilter.',
            human: unreadableSignature(signerName),
            statusCode: 400,
        });
    }

    if (!SUPPORTED_SUB_FILTERS.includes(subFilter)) {
        throw new SimpleError({
            code: 'unsupported_signature_format',
            message: `Unsupported signature format /${subFilter}.`,
            human: $t('De digitale ondertekening van dit bestand heeft een vorm die we niet kunnen controleren. Laad het originele pdf-bestand op dat je van {signerName} kreeg.', { signerName }),
            statusCode: 400,
        });
    }

    const signedBytes = new Uint8Array(firstLength + secondLength);
    signedBytes.set(bytes.subarray(firstOffset, firstOffset + firstLength), 0);
    signedBytes.set(bytes.subarray(secondOffset, secondOffset + secondLength), firstLength);

    return { byteRange, container, signedBytes, subFilter };
}
