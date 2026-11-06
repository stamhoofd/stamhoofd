import { isSimpleError } from '@common/errors';
import type { SimpleError } from '@common/errors';
import { describe, expect, test } from 'vitest';

import { locatePdfSignature } from '../src/PdfSignatureLocator.js';
const SIGNER_NAME = 'Signing Authority';

/**
 * These cases need no cryptography: they are about what the signature claims to cover. Building the
 * documents by hand keeps the offsets visible, which is the whole point of the checks.
 */
function document(options: { byteRange?: string; contents?: string; subFilter?: string; trailer?: string; header?: string } = {}): Uint8Array {
    const header = options.header ?? '%PDF-1.7\n';
    const subFilter = options.subFilter ?? '/SubFilter /ETSI.CAdES.detached ';
    const contents = options.contents ?? '<abcdef>';
    const trailer = options.trailer ?? 'trailer\n<< /Size 2 >>\n%%EOF\n';

    const prefix = `${header}5 0 obj\n<< /Type /Sig ${subFilter}/ByteRange `;
    // Two passes: the first learns where /Contents lands, the second fills in the real offsets.
    const measure = (byteRange: string) => `${prefix}${byteRange} /Contents ${contents} >>\nendobj\n${trailer}`;
    const placeholder = measure('[0000000000 0000000000 0000000000 0000000000]');
    const contentsStart = placeholder.indexOf(contents, prefix.length);
    const contentsEnd = contentsStart + contents.length;
    const byteRange = options.byteRange
        ?? `[${[0, contentsStart, contentsEnd, placeholder.length - contentsEnd].map(value => String(value).padStart(10, '0')).join(' ')}]`;

    return new TextEncoder().encode(measure(byteRange));
}

function expectFailure(bytes: Uint8Array, code: string) {
    let thrown: unknown;

    try {
        locatePdfSignature(bytes, SIGNER_NAME);
    } catch (error) {
        thrown = error;
    }

    expect(isSimpleError(thrown)).toBe(true);
    expect((thrown as SimpleError).code).toBe(code);
    // Every rejection has something to show the member.
    expect((thrown as SimpleError).human).toBeTruthy();
    // The explanation names the caller's signer, not a placeholder and not FOD Justitie.
    expect((thrown as SimpleError).human).toContain(SIGNER_NAME);
    expect((thrown as SimpleError).human).not.toContain('{');
}

describe('locatePdfSignature', () => {
    test('locates the signature and the bytes it covers', () => {
        const bytes = document();
        const located = locatePdfSignature(bytes, SIGNER_NAME);

        expect(located.subFilter).toBe('ETSI.CAdES.detached');
        expect([...located.container]).toEqual([0xab, 0xcd, 0xef]);

        const [firstOffset, firstLength, secondOffset, secondLength] = located.byteRange;

        expect(firstOffset).toBe(0);
        expect(secondOffset + secondLength).toBe(bytes.length);
        expect(located.signedBytes.length).toBe(firstLength + secondLength);
        // The one part the signature cannot cover is the signature itself.
        expect(located.signedBytes.length).toBe(bytes.length - '<abcdef>'.length);
    });

    test('rejects a file that is not a PDF', () => {
        expectFailure(new TextEncoder().encode('not a pdf at all'), 'not_a_pdf');
        expectFailure(document({ header: 'PDF-1.7\n' }), 'not_a_pdf');
    });

    test('rejects a PDF without a signature', () => {
        expectFailure(new TextEncoder().encode('%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n'), 'no_signature');
    });

    test('rejects a PDF with more than one signature', () => {
        const bytes = new TextEncoder().encode('%PDF-1.7\n5 0 obj\n<< /ByteRange [0 1 2 3] >>\nendobj\n6 0 obj\n<< /ByteRange [0 1 2 3] >>\nendobj\n%%EOF\n');

        expectFailure(bytes, 'multiple_signatures');
    });

    test('rejects a second /SubFilter, even without a second byte range', () => {
        // A decoy signature format earlier in the file. Before the uniqueness rule this was the one
        // that got read, which is not the dictionary whose byte range was checked.
        const bytes = document({ header: '%PDF-1.7\n9 0 obj\n<< /Type /Sig /SubFilter /ETSI.CAdES.detached >>\nendobj\n' });

        expectFailure(bytes, 'multiple_signatures');
    });

    test('rejects an unreadable byte range', () => {
        expectFailure(document({ byteRange: '[0 10 20]' }), 'malformed_signature_dictionary');
        expectFailure(document({ byteRange: '0 10 20 30' }), 'malformed_signature_dictionary');
        expectFailure(document({ byteRange: '[0 10 20 30 40]' }), 'malformed_signature_dictionary');
    });

    test('rejects a byte range that does not start at the first byte', () => {
        const bytes = document();
        const shifted = document({ byteRange: new TextDecoder().decode(bytes).match(/\[[^\]]*\]/)![0].replace('0000000000', '0000000001') });

        expectFailure(shifted, 'malformed_signature_dictionary');
    });

    test('rejects bytes appended after signing', () => {
        // Exactly what an incremental update looks like: the signed ranges no longer reach the end.
        const bytes = document({ trailer: 'trailer\n<< /Size 2 >>\n%%EOF\n' });
        const appended = new Uint8Array(bytes.length + 5);
        appended.set(bytes, 0);
        appended.set(new TextEncoder().encode('junk!'), bytes.length);

        expectFailure(appended, 'incomplete_coverage');
    });

    test('rejects a gap between the signed ranges that is not the signature', () => {
        // Same offsets, but the gap now holds a dictionary entry rather than the hex signature.
        expectFailure(document({ contents: '(abcdef)' }), 'incomplete_coverage');
    });

    test('rejects a gap that is not a /Contents entry', () => {
        const bytes = document();
        const text = new TextDecoder().decode(bytes).replace('/Contents <', '/Reserved <');

        expectFailure(new TextEncoder().encode(text), 'incomplete_coverage');
    });

    test('rejects a /Contents entry that is not hexadecimal', () => {
        expectFailure(document({ contents: '<abcdeg>' }), 'malformed_signature_dictionary');
        expectFailure(document({ contents: '<abcde>' }), 'malformed_signature_dictionary');
        expectFailure(document({ contents: '<>' }), 'malformed_signature_dictionary');
    });

    test('accepts the zero padding a signing library leaves in /Contents', () => {
        const located = locatePdfSignature(document({ contents: `<abcdef${'0'.repeat(20)}>` }), SIGNER_NAME);

        expect([...located.container.subarray(0, 3)]).toEqual([0xab, 0xcd, 0xef]);
    });

    test('rejects a signature format it does not verify', () => {
        expectFailure(document({ subFilter: '/SubFilter /adbe.x509.rsa_sha1 ' }), 'unsupported_signature_format');
        expectFailure(document({ subFilter: '' }), 'malformed_signature_dictionary');
    });

    test('accepts both detached CMS formats', () => {
        for (const subFilter of ['ETSI.CAdES.detached', 'adbe.pkcs7.detached']) {
            expect(locatePdfSignature(document({ subFilter: `/SubFilter /${subFilter} ` }), SIGNER_NAME).subFilter).toBe(subFilter);
        }
    });
});
