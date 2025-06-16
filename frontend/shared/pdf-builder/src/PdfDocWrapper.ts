import { getLastPageIndex, getLastPageNumber } from './pdf-helpers';
import { PdfItemDrawOptions } from './PdfItem';

/**
 * Wrapper around the pdf document to make it easier to draw things on the pdf document.
 */
export class PdfDocWrapper {
    get safeMargins(): PDFKit.PDFPage['margins'] {
        return {
            left: this.doc.page.margins.left,
            right: this.doc.page.margins.right,
            top: this.doc.page.margins.top,
            bottom: this.doc.page.margins.bottom + this.extraBottomMargin,
        };
    }

    constructor(readonly doc: PDFKit.PDFDocument, private readonly extraBottomMargin: number) {
    }

    getPageWidthWithoutMargins() {
        const page = this.doc.page;
        const margins = page.margins;

        return page.width - margins.left - margins.right;
    }

    getLastPageNumber() {
        return getLastPageNumber(this.doc);
    }

    getLastPageIndex() {
        return getLastPageIndex(this.doc);
    }

    getAvailableHeight(): number {
        const y = this.doc.y;
        return this.doc.page.height - y - this.safeMargins.bottom;
    }

    goToNextPage() {
        const currentPageIndex = this.getLastPageIndex();
        this.doc.addPage();
        this.doc.switchToPage(currentPageIndex + 1);
        this.doc.y = this.safeMargins.top;
    }

    getNextPosition(options: PdfItemDrawOptions = {}) {
        const position = options.position;

        const x = position?.x === undefined ? this.doc.x : position.x;
        const y = position?.y === undefined ? this.doc.y : position.y;

        return { x, y };
    }
}
