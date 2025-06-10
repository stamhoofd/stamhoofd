import { PdfItem, PdfItemDrawOptions } from '../pdf-item';

/**
 * Adds spacing between items
 */
export class Spacing implements PdfItem {
    /**
     *
     * @param height height of the spacing
     * @param width width of the spacing
     */
    constructor(private readonly height: number = 0, private readonly width: number = 0) {
    }

    draw(doc: PDFKit.PDFDocument, options?: PdfItemDrawOptions): void {
        const x = options?.position?.x === undefined ? doc.x : options.position.x;
        const y = options?.position?.y === undefined ? doc.y : options.position.y;

        if (this.height > 0) {
            doc.y = y + this.height;
        }

        if (this.width > 0) {
            doc.x = x + this.width;
        }
    }

    getHeight(_doc: PDFKit.PDFDocument): number {
        return this.height;
    }

    getWidth(_doc: PDFKit.PDFDocument): number | undefined {
        return this.width;
    }
}
