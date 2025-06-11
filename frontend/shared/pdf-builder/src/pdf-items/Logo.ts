import { PdfDocWrapper } from '../PdfDocWrapper';
import { PdfItem } from '../PdfItem';

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

    draw(docWrapper: PdfDocWrapper): void {
        const doc = docWrapper.doc;
        const { src, width } = this.options;
        const margins = docWrapper.safeMargins;

        doc.image(src, doc.page.width - margins.right - width, margins.top, { width });
    }

    getWidth(_docWrapper: PdfDocWrapper): number {
        return this.options.width;
    }

    getHeight(_docWrapper: PdfDocWrapper): number {
        // todo?
        return 0;
    }
}
