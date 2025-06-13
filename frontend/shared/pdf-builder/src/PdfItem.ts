import { PdfDocWrapper } from './PdfDocWrapper';
import { PdfFont } from './PdfFont';

export type PdfItemDrawOptions = {
    /**
     * The maximum width of the item.
     */
    maxWidth?: number;
    /**
     * The position on the page where
     * the item should be drawn. Defaults to the current position.
     */
    position?: {
        x?: number;
        y?: number;
    };
};

export type PdfItemGetHeightOptions = {
    maxWidth?: number;
};

/**
 * An interface with methods that can be used to draw something on a pdf document
 * (for example text, images, tables, etc.).
 */
export interface PdfItem {
    /**
     * Draw the item on the document.
     * @param docWrapper
     * @param options
     */
    draw(docWrapper: PdfDocWrapper, options: PdfItemDrawOptions): void;

    /**
     * Returns the height if the item would be drawn on the document. The return value of this function should be independent of external PdfItems such as a parent item. It can be dependent on child items.
     * @param docWrapper
     * @param options
     */
    getHeight(docWrapper: PdfDocWrapper, options: PdfItemGetHeightOptions): number;

    /**
     * Returns the width if the item would be drawn on the document. The return value of this function should be independent of external PdfItems such as a parent item. It can be dependent on child items.
     * @param docWrapper
     */
    getWidth(docWrapper: PdfDocWrapper): number | undefined;

    /**
     * The minimum width of the item
     * @param docWrapper
     */
    getMinWidth?(docWrapper: PdfDocWrapper): number | undefined;

    /**
     * Returns the fonts that should be registered before drawing the item.
     */
    getFonts?(): PdfFont[];
}
