import { describe, expect, test } from 'vitest';

import { extractPdfLines } from '../src/extractPdfLines.js';
import { createTestPdf, createTestPdfWithoutText } from '../src/testing/createTestPdf.js';

describe('extractPdfLines', () => {
    test('returns the lines of a pdf in reading order', async () => {
        const pdf = createTestPdf([
            // Written in a different order than they are printed
            { text: 'Derde regel', y: 760 },
            { text: 'Eerste regel', y: 800 },
            { text: 'Tweede regel', y: 780 },
        ]);

        expect(await extractPdfLines(pdf)).toEqual([
            'Eerste regel',
            'Tweede regel',
            'Derde regel',
        ]);
    });

    test('joins items on the same line from left to right', async () => {
        const pdf = createTestPdf([
            { text: 'rechts', x: 200, y: 800 },
            { text: 'links', x: 50, y: 800 },
        ]);

        expect(await extractPdfLines(pdf)).toEqual(['links rechts']);
    });

    test('fails for a pdf without a text layer', async () => {
        await expect(extractPdfLines(createTestPdfWithoutText())).rejects.toThrow(
            expect.objectContaining({ code: 'pdf_without_text' }),
        );
    });

    test('says what to do about it, so the caller can pass the error on', async () => {
        await expect(extractPdfLines(createTestPdfWithoutText())).rejects.toThrow(
            expect.objectContaining({ human: expect.stringContaining('originele pdf-bestand') }),
        );
    });

    test('fails for something that is not a pdf', async () => {
        await expect(extractPdfLines(new Uint8Array(Buffer.from('This is not a pdf')))).rejects.toThrow(
            expect.objectContaining({ code: 'invalid_pdf' }),
        );
    });

    test('fails for an empty file', async () => {
        await expect(extractPdfLines(new Uint8Array())).rejects.toThrow(
            expect.objectContaining({ code: 'invalid_pdf' }),
        );
    });

    test('fails for a file larger than the limit, naming it', async () => {
        const pdf = createTestPdf([{ text: 'x'.repeat(6 * 1024 * 1024), y: 800 }]);

        await expect(extractPdfLines(pdf)).rejects.toThrow(
            expect.objectContaining({ code: 'pdf_too_large', human: expect.stringContaining('5 MB') }),
        );
    });

    test('fails for a pdf with more pages than the limit, naming it', async () => {
        const pdf = createTestPdf([{ text: 'Eerste regel', y: 800 }], { pages: 11 });

        await expect(extractPdfLines(pdf)).rejects.toThrow(
            expect.objectContaining({ code: 'pdf_too_many_pages', human: expect.stringContaining('10') }),
        );
    });

    test('does not consume the buffer it is given', async () => {
        const pdf = createTestPdf([{ text: 'Eerste regel', y: 800 }]);

        await extractPdfLines(pdf);

        expect(await extractPdfLines(pdf)).toEqual(['Eerste regel']);
    });
});
