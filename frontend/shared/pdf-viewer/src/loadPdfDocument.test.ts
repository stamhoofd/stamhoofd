import { expect, test, vi } from 'vitest';
import { loadPdfDocument } from './loadPdfDocument.ts';
import { createTestPdf } from './tests/createTestPdf.ts';

/**
 * A port-initialized PDFWorker never records the thread it talks to, so nothing in pdf.js
 * terminates it. Every load would leave an idle worker thread behind, and a viewer that reloads on
 * every change of its data leaves one per document.
 */
test('It terminates the worker thread of a document it opened', async () => {
    const terminate = vi.spyOn(Worker.prototype, 'terminate');

    try {
        const loaded = await loadPdfDocument(createTestPdf({ pageCount: 1 }));
        expect(terminate).not.toHaveBeenCalled();

        await loaded.destroy();
        expect(terminate).toHaveBeenCalledOnce();
    } finally {
        terminate.mockRestore();
    }
});

test('It terminates the worker thread of a document it could not open', async () => {
    const terminate = vi.spyOn(Worker.prototype, 'terminate');

    try {
        await expect(loadPdfDocument(new Uint8Array([1, 2, 3, 4]))).rejects.toThrow();
        expect(terminate).toHaveBeenCalledOnce();
    } finally {
        terminate.mockRestore();
    }
});
