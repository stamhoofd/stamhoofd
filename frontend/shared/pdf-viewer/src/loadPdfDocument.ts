import type { PDFDocumentProxy } from 'pdfjs-dist';
import { getDocument, PDFWorker } from 'pdfjs-dist';
// Bundled as a worker rather than referenced by url: pdf.js ships its worker as a .mjs file, and a
// static host that serves that extension as application/octet-stream makes the browser refuse the
// module script. The bundler emits a .js chunk instead, so the viewer does not depend on the
// server's mime types.
import PdfJsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker';

export interface LoadedPdf {
    document: PDFDocumentProxy;

    /** Closes the document and terminates the worker it was given. */
    destroy(): Promise<void>;
}

export async function loadPdfDocument(data: Uint8Array): Promise<LoadedPdf> {
    // A worker passed in belongs to the caller: pdf.js only terminates the one it creates itself.
    const worker = PDFWorker.create({ port: new PdfJsWorker() });

    // pdf.js transfers the buffer it receives to its worker, which leaves the caller holding an
    // empty array. The app still needs its own bytes (to download or upload the same pdf), so the
    // viewer hands over a copy.
    const task = getDocument({ data: new Uint8Array(data), worker });

    try {
        const document = await task.promise;

        return {
            document,
            async destroy() {
                await task.destroy();
                worker.destroy();
            },
        };
    }
    catch (error) {
        worker.destroy();
        throw error;
    }
}
