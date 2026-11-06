import { describe, expect, test, vi } from 'vitest';

import { extractPdfLines } from '../src/extractPdfLines.js';
import { createMainThreadWorker } from '../src/pdfjs.js';
import { createTestPdf } from './helpers/createTestPdf.js';

/**
 * How this package sets pdf.js up, rather than what it reads. Both of these were wrong once and
 * neither shows up in the lines that come out, so they are worth asserting on their own.
 */
describe('the pdf.js setup', () => {
    test('leaves no worker on globalThis for another consumer to inherit', async () => {
        // pdf.js reads this global for every document anyone opens, so a package that leaves it set
        // takes a pdf viewer in the same bundle off its worker and onto the main thread
        await extractPdfLines(createTestPdf([{ text: 'Eerste regel', y: 800 }]));

        expect((globalThis as { pdfjsWorker?: unknown }).pdfjsWorker).toBeUndefined();
    });

    test('closes the channel of every worker it creates', () => {
        const { worker, close } = createMainThreadWorker(0);

        worker.destroy();
        close();

        // An open port keeps Node's event loop alive, so a leak here hangs the api rather than
        // failing it
        expect(worker.destroyed).toBe(true);
    });

    test('reads a second document after the first has been torn down', async () => {
        const pdf = createTestPdf([{ text: 'Eerste regel', y: 800 }]);

        expect(await extractPdfLines(pdf)).toEqual(['Eerste regel']);
        expect(await extractPdfLines(pdf)).toEqual(['Eerste regel']);
    });

    test('keeps pdf.js from writing its own account of a document to the console', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        try {
            // This pdf prints in Helvetica without embedding it, which pdf.js warns about: the
            // member is told what to do about a file through a SimpleError, not through the console
            await extractPdfLines(createTestPdf([{ text: 'Eerste regel', y: 800 }]));

            expect(warn).not.toHaveBeenCalled();
        } finally {
            warn.mockRestore();
        }
    });
});
