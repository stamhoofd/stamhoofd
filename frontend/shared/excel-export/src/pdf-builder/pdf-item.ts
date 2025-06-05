import { PdfFont } from './pdf-font';

export interface PdfItem {
    draw(doc: PDFKit.PDFDocument, coordinates?: { x?: number; y?: number }): void;
    getHeight(doc: PDFKit.PDFDocument): number;
    getWidth(doc: PDFKit.PDFDocument): number;
    getFonts?: () => PdfFont[];
}
