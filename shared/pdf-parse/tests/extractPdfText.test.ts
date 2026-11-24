import { describe, expect, test } from 'vitest';

import { extractPdfText } from '../src/extractPdfText.js';
import { createTestPdf, createTestPdfWithoutText } from './helpers/createTestPdf.js';

describe('extractPdfText', () => {
    test('returns the lines of a pdf in reading order', async () => {
        const pdf = createTestPdf([
            // Written in a different order than they are printed
            { text: 'Derde regel', y: 760 },
            { text: 'Eerste regel', y: 800 },
            { text: 'Tweede regel', y: 780 },
        ]);

        expect((await extractPdfText(pdf)).lines.map(line => line.text)).toEqual([
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

        expect((await extractPdfText(pdf)).lines.map(line => line.text)).toEqual(['links rechts']);
    });

    test('fails for a pdf without a text layer', async () => {
        await expect(extractPdfText(createTestPdfWithoutText())).rejects.toThrow(
            expect.objectContaining({ code: 'pdf_without_text' }),
        );
    });

    test('says what to do about it, so the caller can pass the error on', async () => {
        await expect(extractPdfText(createTestPdfWithoutText())).rejects.toThrow(
            expect.objectContaining({ human: expect.stringContaining('originele pdf-bestand') }),
        );
    });

    test('fails for something that is not a pdf', async () => {
        await expect(extractPdfText(new Uint8Array(Buffer.from('This is not a pdf')))).rejects.toThrow(
            expect.objectContaining({ code: 'invalid_pdf' }),
        );
    });

    test('fails for an empty file', async () => {
        await expect(extractPdfText(new Uint8Array())).rejects.toThrow(
            expect.objectContaining({ code: 'invalid_pdf' }),
        );
    });

    test('fails for a file larger than the limit, naming it', async () => {
        const pdf = createTestPdf([{ text: 'x'.repeat(6 * 1024 * 1024), y: 800 }]);

        await expect(extractPdfText(pdf)).rejects.toThrow(
            expect.objectContaining({ code: 'pdf_too_large', human: expect.stringContaining('5 MB') }),
        );
    });

    test('carries the page a line was printed on, and the pages of the document', async () => {
        const pdf = createTestPdf([{ text: 'Eerste regel', y: 800 }], { pages: 3 });

        const { pageCount, lines } = await extractPdfText(pdf);

        expect(pageCount).toBe(3);
        expect(lines.map(line => line.page)).toEqual([1, 2, 3]);
    });

    test('carries where a line was printed and how big', async () => {
        const pdf = createTestPdf([
            { text: 'BLANCO STRAFREGISTER', x: 125, y: 352, fontSize: 20 },
            { text: '(05/10/2026)', x: 390, y: 352 },
        ]);

        const [line] = (await extractPdfText(pdf)).lines;

        expect(line.text).toBe('BLANCO STRAFREGISTER (05/10/2026)');
        expect(line.x).toBe(125);
        expect(line.y).toBe(352);
    });

    test('answers the largest font size on a line, so a heading beside a smaller date stays a heading', async () => {
        const pdf = createTestPdf([
            { text: 'BLANCO STRAFREGISTER', x: 125, y: 352, fontSize: 20 },
            { text: '(05/10/2026)', x: 390, y: 352, fontSize: 14 },
        ]);

        const [line] = (await extractPdfText(pdf)).lines;

        expect(line.fontSize).toBe(20);
    });

    test('answers the left edge of a line, whichever item the pdf drew first', async () => {
        const pdf = createTestPdf([
            { text: 'rechts', x: 200, y: 800 },
            { text: 'links', x: 50, y: 800 },
        ]);

        expect((await extractPdfText(pdf)).lines[0].x).toBe(50);
    });

    test('fails for a pdf with more pages than the limit, naming it', async () => {
        const pdf = createTestPdf([{ text: 'Eerste regel', y: 800 }], { pages: 11 });

        await expect(extractPdfText(pdf)).rejects.toThrow(
            expect.objectContaining({ code: 'pdf_too_many_pages', human: expect.stringContaining('10') }),
        );
    });

    test('does not consume the buffer it is given', async () => {
        const pdf = createTestPdf([{ text: 'Eerste regel', y: 800 }]);

        await extractPdfText(pdf);

        expect((await extractPdfText(pdf)).lines.map(line => line.text)).toEqual(['Eerste regel']);
    });
});
