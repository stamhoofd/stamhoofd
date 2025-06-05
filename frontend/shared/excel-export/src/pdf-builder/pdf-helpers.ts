export function mmToPoints(mm: number): number {
    return Math.round(mm * 2.834666666666667); // = 1mm
}

export function getLastPageNumber(doc: PDFKit.PDFDocument) {
    const range = doc.bufferedPageRange();
    return range.start + range.count;
}
