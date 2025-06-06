import { PdfItem } from '../pdf-item';

/**
 * A fixed logo in the top right corner
 */
export class Logo implements PdfItem {
    constructor(private readonly options: {
        src: PDFKit.Mixins.ImageSrc;
        /**
         * The width of the logo
         */
        width: number;
    }) {
    }

    draw(doc: PDFKit.PDFDocument): void {
        const { src, width } = this.options;
        const margins = doc.page.margins;

        doc.image(src, doc.page.width - margins.right - width, margins.top, { width });
    }

    getWidth(_doc: PDFKit.PDFDocument): number {
        return this.options.width;
    }

    getHeight(_doc: PDFKit.PDFDocument): number {
        // todo?
        return 0;
    }
}
