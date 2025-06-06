import { PdfFont } from '../pdf-font';
import { PdfItem, PdfItemDrawOptions } from '../pdf-item';

/**
 * Represents a container of items and
 * makes it possible to set a max width.
 */
export class PdfContainer implements PdfItem {
    /**
     *
     * @param items the items in the container
     * @param maxWidth the max width of the container
     */
    constructor(private readonly items: PdfItem[], private readonly maxWidth?: number) {
    }

    draw(doc: PDFKit.PDFDocument, options?: PdfItemDrawOptions): void {
        const _options = { ...options };
        const originalX = options?.position?.x === undefined ? doc.x : options.position.x;

        if (this.maxWidth !== undefined) {
            if (options?.maxWidth !== undefined) {
                _options.maxWidth = Math.min(this.maxWidth, options.maxWidth);
            }
            else {
                _options.maxWidth = this.maxWidth;
            }
        }

        this.items.forEach((item, index) => {
            item.draw(doc, _options);

            if (index === 0) {
                _options.position = {
                    x: originalX,
                    y: undefined,
                };
            }
        });
    }

    getHeight(doc: PDFKit.PDFDocument): number {
        return this.items.reduce((acc, item) => acc + item.getHeight(doc), 0);
    }

    getWidth(_doc: PDFKit.PDFDocument): number | undefined {
        return this.maxWidth;
    }

    getFonts(): PdfFont[] {
        return this.items.flatMap(item => item.getFonts ? item.getFonts() : []);
    }
}
