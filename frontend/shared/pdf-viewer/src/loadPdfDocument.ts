import type { PDFDocumentProxy } from 'pdfjs-dist';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = workerUrl;

export async function loadPdfDocument(data: Uint8Array): Promise<PDFDocumentProxy> {
    // pdf.js transfers the buffer it receives to its worker, which leaves the caller holding an
    // empty array. The app still needs its own bytes (to download or upload the same pdf), so the
    // viewer hands over a copy.
    const document = await getDocument({ data: new Uint8Array(data) }).promise;
    return document;
}
