import type { PdfText, PdfTextLine } from '@stamhoofd/pdf-parse';
import { readJudicialRecordLayout } from '../src/JudicialRecordLayout.js';

/**
 * Where an issued extract prints the values these checks read, measured off real ones. A test that
 * moved a line by hand would only ever agree with itself, so every case below starts here.
 */
const EXTRACT_LINES: PdfTextLine[] = [
    { text: 'Ref. doc : 20261102-5351 - Datum : 02/11/2026 Betreft : JANSSENS JAN - 05/04/2006 1 / 1', page: 1, x: 38, y: 796, fontSize: 8 },
    { text: 'Centraal strafregister', page: 1, x: 37, y: 725, fontSize: 10 },
    { text: 'Uittreksel uit het strafregister', page: 1, x: 36, y: 603, fontSize: 16 },
    { text: 'Naam : JANSSENS', page: 1, x: 36, y: 573, fontSize: 10 },
    { text: 'Voorna(a)m(en) : JAN PIETER', page: 1, x: 36, y: 559, fontSize: 10 },
    { text: 'Geboortedatum : 05/04/2006', page: 1, x: 36, y: 545, fontSize: 10 },
    { text: 'Finaliteit van het uittreksel :', page: 1, x: 36, y: 473, fontSize: 10 },
    { text: '596.2 - model bestemd voor de contacten met minderjarigen', page: 1, x: 36, y: 460, fontSize: 9 },
    { text: 'BLANCO STRAFREGISTER (02/11/2026)', page: 1, x: 125.03, y: 352, fontSize: 20 },
    { text: 'De authenticiteit van dit uittreksel kan tot 01/02/2027 gecontroleerd worden via :', page: 1, x: 34, y: 157, fontSize: 8 },
    { text: 'https://just-crimeviewer-ctz.just.fgov.be/record/2331f637-9f30-46bd-9a3f-be62ff76d7dc-CJCS', page: 1, x: 34, y: 149, fontSize: 8 },
];

const MARKER = 'BLANCO STRAFREGISTER (02/11/2026)';

function layoutOf(lines: PdfTextLine[], pageCount = 1) {
    return readJudicialRecordLayout({ pageCount, lines } satisfies PdfText);
}

/** The same document with one line moved, resized, removed or repeated. */
function withLine(text: string, changes: Partial<PdfTextLine> | null, extra?: PdfTextLine): PdfTextLine[] {
    const lines = EXTRACT_LINES.flatMap((line) => {
        if (line.text !== text) {
            return [line];
        }

        return changes === null ? [] : [{ ...line, ...changes }];
    });

    return extra ? [...lines, extra] : lines;
}

describe('readJudicialRecordLayout', () => {
    test('accepts an extract as FOD Justitie prints it', () => {
        expect(layoutOf(EXTRACT_LINES)).toEqual({
            hasUnexpectedPageCount: false,
            hasUnexpectedPositions: false,
            hasUnexpectedMarker: false,
        });
    });

    describe('the page count', () => {
        test('refuses a document of more than one page', () => {
            expect(layoutOf(EXTRACT_LINES, 2).hasUnexpectedPageCount).toBe(true);
        });

        test('refuses a value printed on a second page', () => {
            expect(layoutOf(withLine(MARKER, { page: 2 }), 2).hasUnexpectedMarker).toBe(true);
        });
    });

    describe('the empty record marker', () => {
        test('refuses it printed somewhere else on the page', () => {
            expect(layoutOf(withLine(MARKER, { y: 300 })).hasUnexpectedMarker).toBe(true);
        });

        test('refuses it printed in the margin a field is printed in', () => {
            expect(layoutOf(withLine(MARKER, { x: 36 })).hasUnexpectedMarker).toBe(true);
        });

        test('refuses it printed in the size of the body text around it', () => {
            expect(layoutOf(withLine(MARKER, { fontSize: 10 })).hasUnexpectedMarker).toBe(true);
        });

        test('refuses it printed larger than the heading it is', () => {
            expect(layoutOf(withLine(MARKER, { fontSize: 28 })).hasUnexpectedMarker).toBe(true);
        });

        test('refuses a second one printed elsewhere, whichever of the two a check read', () => {
            expect(layoutOf(withLine(MARKER, {}, { text: MARKER, page: 1, x: 36, y: 250, fontSize: 10 })).hasUnexpectedMarker).toBe(true);
        });

        test('reports it apart from the rest of the document', () => {
            expect(layoutOf(withLine(MARKER, { y: 300 })).hasUnexpectedPositions).toBe(false);
        });

        test('accepts the baseline a printed line is nudged to', () => {
            expect(layoutOf(withLine(MARKER, { y: 353.5 })).hasUnexpectedMarker).toBe(false);
        });
    });

    describe('the values the other checks read', () => {
        test('refuses a name printed somewhere else', () => {
            expect(layoutOf(withLine('Naam : JANSSENS', { y: 400 })).hasUnexpectedPositions).toBe(true);
        });

        test('refuses a purpose printed in the size of a heading', () => {
            expect(layoutOf(withLine('596.2 - model bestemd voor de contacten met minderjarigen', { fontSize: 20 })).hasUnexpectedPositions).toBe(true);
        });

        test('refuses a document that does not print one of them at all', () => {
            expect(layoutOf(withLine('Geboortedatum : 05/04/2006', null)).hasUnexpectedPositions).toBe(true);
        });

        test('refuses a document whose header is not the header of an extract', () => {
            expect(layoutOf(withLine('Uittreksel uit het strafregister', { text: 'UITTREKSEL UIT HET STRAFREGISTER - kopie' })).hasUnexpectedPositions).toBe(true);
        });

        test('reports them apart from the marker', () => {
            expect(layoutOf(withLine('Naam : JANSSENS', { y: 400 })).hasUnexpectedMarker).toBe(false);
        });

        test('accepts text it has no expectation about, wherever the document prints it', () => {
            expect(layoutOf(withLine('Centraal strafregister', { x: 300, y: 700, fontSize: 13 })).hasUnexpectedPositions).toBe(false);
        });
    });
});
