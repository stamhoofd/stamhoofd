import { AppManager } from '@stamhoofd/networking';
import { Formatter } from '@stamhoofd/utility';
import { Buffer } from 'buffer';
import { PdfFont } from './pdf-font';
import { PdfItem } from './pdf-item';

// polyfill
globalThis.Buffer = Buffer;

export class PdfRenderer {
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
        for (const { name, url } of fonts) {
            doc.registerFont(name, await (await fetch(url)).arrayBuffer());
        }
    }

    async render(doc: PDFKit.PDFDocument, pdfItems: PdfItem[]) {
        const bufferPromise = this.createBuffer(doc);

        for (const pdfItem of pdfItems) {
            if (pdfItem.getFonts) {
                await this.registerFonts(doc, pdfItem.getFonts());
            }

            // todo: where should be checked if next page is needed?
            pdfItem.draw(doc);
        }

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
