import { PdfDocWrapper } from './PdfDocWrapper';
import { PdfFont } from './PdfFont';

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

export type PdfItemGetWidthOptions = {
    maxHeight?: number;
};

export interface PdfItem {
    draw(docWrapper: PdfDocWrapper, options: PdfItemDrawOptions): void;
    getHeight(docWrapper: PdfDocWrapper, options: PdfItemGetHeightOptions): number;
    getWidth(docWrapper: PdfDocWrapper, options: PdfItemGetWidthOptions): number | undefined;
    getFonts?(): PdfFont[];
}
