import { PdfFont } from './pdf-font';

export type PdfItemDrawOptions = {
    maxWidth?: number;
    position?: {
        x?: number;
        y?: number;
    };
};

export type PdfItemGetHeightOptions = {
    maxWidth?: number;
};

export interface PdfItem {
    draw(doc: PDFKit.PDFDocument, options: PdfItemDrawOptions): void;
    getHeight(doc: PDFKit.PDFDocument, options: PdfItemGetHeightOptions): number;
    getWidth(doc: PDFKit.PDFDocument): number | undefined;
    getFonts?(): PdfFont[];
    onLeavePage?: () => void;
}
