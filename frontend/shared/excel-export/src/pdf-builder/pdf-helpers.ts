export function mmToPoints(mm: number): number {
    return Math.round(mm * 2.834666666666667); // = 1mm
}

export function getLastPageNumber(doc: PDFKit.PDFDocument) {
    const range = doc.bufferedPageRange();
    return range.start + range.count;
}

export function getPageWidthWithoutMargins(doc: PDFKit.PDFDocument): number {
    return doc.page.width - doc.page.margins.left - doc.page.margins.right;
}

export function getPageHeighthWithoutMargins(doc: PDFKit.PDFDocument): number {
    return doc.page.height - doc.page.margins.top - doc.page.margins.bottom;
}
