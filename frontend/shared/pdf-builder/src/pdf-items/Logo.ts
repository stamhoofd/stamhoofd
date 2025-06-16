import { PdfDocWrapper } from '../PdfDocWrapper';
import { PdfItem } from '../PdfItem';

/**
 * A fixed logo in the top right corner
 */
export class Logo implements PdfItem {
    constructor(private readonly options: {
        src: PDFKit.Mixins.ImageSrc;
        imageOptions: PDFKit.Mixins.ImageOption & { width: number };
    }) {
    }

    draw(docWrapper: PdfDocWrapper): void {
        const doc = docWrapper.doc;
        const { src, imageOptions } = this.options;
        const margins = docWrapper.safeMargins;

        doc.image(src, doc.page.width - margins.right - this.options.imageOptions.width, margins.top, imageOptions);
    }

    getWidth(_docWrapper: PdfDocWrapper): number | undefined {
        return this.options.imageOptions.width;
    }

    getHeight(_docWrapper: PdfDocWrapper): number {
        // todo?
        return this.options.imageOptions.height ?? 0;
    }
}
