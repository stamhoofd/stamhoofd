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

describe('an engine without Promise.withResolvers', () => {
    // pdf.js 6 uses it throughout and the legacy build does not polyfill it, while it arrived only
    // in Safari 17.4 and IPHONEOS_DEPLOYMENT_TARGET is 15.0
    test('is polyfilled by the time pdf.js runs', () => {
        expect(typeof Promise.withResolvers).toBe('function');
    });

    test('hands back a promise and the two functions that settle it', async () => {
        const { promise, resolve } = Promise.withResolvers<string>();

        resolve('JANSSENS');

        await expect(promise).resolves.toBe('JANSSENS');
    });

    test('rejects through the reject it handed back', async () => {
        const { promise, reject } = Promise.withResolvers<string>();

        reject(new Error('nope'));

        await expect(promise).rejects.toThrow('nope');
    });
});
