import { getLastPageNumber, getPageWidthWithoutMargins } from './pdf-helpers';
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

    getNextPosition(options: PdfItemDrawOptions = {}) {
        const position = options.position;

        const x = position?.x === undefined ? this.doc.x : position.x;
        const y = position?.y === undefined ? this.doc.y : position.y;

        return { x, y };
    }
}
