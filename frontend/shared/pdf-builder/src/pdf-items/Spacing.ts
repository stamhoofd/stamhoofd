import { PdfDocWrapper } from '../pdf-doc-wrapper';
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

    draw(docWrapper: PdfDocWrapper, options?: PdfItemDrawOptions): void {
        const { x, y } = docWrapper.getNextPosition(options);
        const doc = docWrapper.doc;

        if (this.height > 0) {
            doc.y = y + this.height;
        }

        if (this.width > 0) {
            doc.x = x + this.width;
        }
    }

    getHeight(_docWrapper: PdfDocWrapper): number {
        return this.height;
    }

    getWidth(_docWrapper: PdfDocWrapper): number | undefined {
        return this.width;
    }
}
