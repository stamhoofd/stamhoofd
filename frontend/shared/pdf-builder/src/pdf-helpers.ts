/**
 * Convert mm to pdf points
 * @param mm
 * @returns pdf points
 */
export function mmToPoints(mm: number): number {
    return Math.round(mm * 2.834666666666667); // = 1mm
}

/**
 * Convert px to pdf points
 * @param px
 * @returns pdf points
 */
export function pxToPoints(mm: number): number {
    return Math.round(mm * 0.75);
}

export function getLastPageIndex(doc: PDFKit.PDFDocument) {
    return getLastPageNumber(doc) - 1;
}

export function getLastPageNumber(doc: PDFKit.PDFDocument) {
    const range = doc.bufferedPageRange();
    return range.start + range.count;
}
