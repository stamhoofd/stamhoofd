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

export interface PdfItem {
    draw(docWrapper: PdfDocWrapper, options: PdfItemDrawOptions): void;
    /**
     * The height if the item would be drawn on an empty page
     * @param docWrapper
     * @param options
     */
    getHeight(docWrapper: PdfDocWrapper, options: PdfItemGetHeightOptions): number;
    /**
     * The width if the item would be drawn on an empty page
     * @param docWrapper
     */
    getWidth(docWrapper: PdfDocWrapper): number | undefined;
    /**
     * The minimum width of the item
     * @param docWrapper
     */
    getMinWidth?(docWrapper: PdfDocWrapper): number | undefined;
    getFonts?(): PdfFont[];
}
