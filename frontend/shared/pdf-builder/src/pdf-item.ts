import { PdfDocWrapper } from './pdf-doc-wrapper';
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
    draw(docWrapper: PdfDocWrapper, options: PdfItemDrawOptions): void;
    getHeight(docWrapper: PdfDocWrapper, options: PdfItemGetHeightOptions): number;
    getWidth(docWrapper: PdfDocWrapper): number | undefined;
    getFonts?(): PdfFont[];
}
