import { AppManager } from '@stamhoofd/networking';
import { Formatter } from '@stamhoofd/utility';
import { Buffer } from 'buffer';
import { PdfDocWrapper } from './PdfDocWrapper';
import { PdfFont } from './PdfFont';
import { PdfItem } from './PdfItem';

// polyfill
globalThis.Buffer = Buffer;

export class PdfRenderer {
    private readonly registeredFonts: Set<PdfFont> = new Set();

    private createBuffer(doc: PDFKit.PDFDocument) {
        return new Promise<Buffer>((resolve) => {
            const bufs: any[] = [];
            doc.on('data', function (d) {
                bufs.push(d);
            });

            doc.on('end', function () {
                const buf = Buffer.concat(bufs);
                resolve(buf);
            });
        });
    }

    private async registerFonts(doc: PDFKit.PDFDocument, fonts: PdfFont[]) {
        for (const font of fonts) {
            if (this.registeredFonts.has(font)) {
                continue;
            }

            const { name, url } = font;
            const response = await fetch(url);
            doc.registerFont(name, await response.arrayBuffer());
            this.registeredFonts.add(font);
        }
    }

    async render(docWrapper: PdfDocWrapper, pdfItems: PdfItem[], beforeFlush?: (docWrapper: PdfDocWrapper) => void) {
        const doc = docWrapper.doc;
        const bufferPromise = this.createBuffer(doc);

        for (const pdfItem of pdfItems) {
            if (pdfItem.getFonts) {
                await this.registerFonts(doc, pdfItem.getFonts());
            }

            pdfItem.draw(docWrapper, {});

            if (doc.y > doc.page.height - docWrapper.safeMargins.bottom) {
                docWrapper.goToNextPage();
            }
        }

        if (beforeFlush) {
            beforeFlush(docWrapper);
        }

        // manually flush pages that have been buffered
        doc.flushPages();

        doc.end();

        const buffer = await bufferPromise;
        return new DownloadablePdf(buffer);
    }
}

export class DownloadablePdf {
    constructor(private readonly buffer: Buffer) {}

    async download(title: string) {
        const fileName = Formatter.slug(title) + '.pdf';
        const blob = new Blob([this.buffer], { type: 'application/pdf' });

        if (AppManager.shared.downloadFile) {
            await AppManager.shared.downloadFile(blob, fileName);
        }
        else {
            const link = document.createElement('a');
            const href = window.URL.createObjectURL(blob);
            link.href = href;
            link.download = fileName;
            link.click();
        }
    }
}
