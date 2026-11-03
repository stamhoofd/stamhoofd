import { createTestPdf, createTestPdfWithoutText } from '../testing/createTestPdf.js';
import { CriminalRecordParseError, CriminalRecordParseErrorCode } from './CriminalRecordParseError.js';
import { extractPdfLines } from './extractPdfLines.js';

describe('extractPdfLines', () => {
    it('returns the lines of a pdf in reading order', async () => {
        const pdf = createTestPdf([
            // Written in a different order than they are printed
            { text: 'Geboortedatum: 05/04/2006', y: 760 },
            { text: 'Naam: JANSSENS', y: 800 },
            { text: 'Voorna(a)m(en): Jan', y: 780 },
        ]);

        expect(await extractPdfLines(pdf)).toEqual([
            'Naam: JANSSENS',
            'Voorna(a)m(en): Jan',
            'Geboortedatum: 05/04/2006',
        ]);
    });

    it('joins items on the same line from left to right', async () => {
        const pdf = createTestPdf([
            { text: 'JANSSENS', x: 200, y: 800 },
            { text: 'Naam:', x: 50, y: 800 },
        ]);

        expect(await extractPdfLines(pdf)).toEqual(['Naam: JANSSENS']);
    });

    it('fails with NO_TEXT for a pdf without a text layer', async () => {
        await expect(extractPdfLines(createTestPdfWithoutText())).rejects.toThrow(
            expect.objectContaining({ code: CriminalRecordParseErrorCode.NoText }),
        );
    });

    it('fails with INVALID_PDF for something that is not a pdf', async () => {
        await expect(extractPdfLines(new Uint8Array(Buffer.from('This is not a pdf')))).rejects.toThrow(
            expect.objectContaining({ code: CriminalRecordParseErrorCode.InvalidPdf }),
        );
    });

    it('fails with INVALID_PDF for an empty file', async () => {
        await expect(extractPdfLines(new Uint8Array())).rejects.toThrow(CriminalRecordParseError);
    });

    it('fails with INVALID_PDF for a file larger than the limit', async () => {
        const pdf = createTestPdf([{ text: 'Naam: JANSSENS', y: 800 }]);

        await expect(extractPdfLines(pdf, { maxBytes: 10, maxPages: 10, timeoutMs: 1000 })).rejects.toThrow(
            expect.objectContaining({ code: CriminalRecordParseErrorCode.InvalidPdf }),
        );
    });

    it('fails with INVALID_PDF for a pdf with more pages than the limit', async () => {
        const pdf = createTestPdf([{ text: 'Naam: JANSSENS', y: 800 }], { pages: 3 });

        await expect(extractPdfLines(pdf, { maxBytes: 5 * 1024 * 1024, maxPages: 2, timeoutMs: 1000 })).rejects.toThrow(
            expect.objectContaining({ code: CriminalRecordParseErrorCode.InvalidPdf }),
        );
    });

    it('does not consume the buffer it is given', async () => {
        const pdf = createTestPdf([{ text: 'Naam: JANSSENS', y: 800 }]);

        await extractPdfLines(pdf);

        expect(await extractPdfLines(pdf)).toEqual(['Naam: JANSSENS']);
    });
});
