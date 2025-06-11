import { getLastPageIndex, getLastPageNumber, getPageWidthWithoutMargins } from './pdf-helpers';
import { PdfItemDrawOptions } from './pdf-item';

export class PdfDocWrapper {
    constructor(readonly doc: PDFKit.PDFDocument) {
    }

    getPageWidthWithoutMargins() {
        return getPageWidthWithoutMargins(this.doc);
    }

    getLastPageNumber() {
        return getLastPageNumber(this.doc);
    }

    getLastPageIndex() {
        return getLastPageIndex(this.doc);
    }

    goToNextPage() {
        const currentPageIndex = this.getLastPageIndex();
        this.doc.addPage();
        this.doc.switchToPage(currentPageIndex + 1);
        this.doc.y = this.doc.page.margins.top;
    }

    getNextPosition(options: PdfItemDrawOptions = {}) {
        const position = options.position;

        const x = position?.x === undefined ? this.doc.x : position.x;
        const y = position?.y === undefined ? this.doc.y : position.y;

        return { x, y };
    }
}
