import type { PdfFont } from './PdfFont';
import type { PdfDocWrapperContract, PdfItemDrawOptions, PdfItemGetHeightOptions } from './PdfContracts';

export type { PdfItemDrawOptions, PdfItemGetHeightOptions } from './PdfContracts';

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
    draw(docWrapper: PdfDocWrapperContract, options: PdfItemDrawOptions): void;

    /**
     * Returns the height if the item would be drawn on the document. The return value of this function should be independent of external PdfItems such as a parent item. It can be dependent on child items.
     * @param docWrapper
     * @param options
     */
    getHeight(docWrapper: PdfDocWrapperContract, options: PdfItemGetHeightOptions): number;

    /**
     * Returns the width if the item would be drawn on the document. The return value of this function should be independent of external PdfItems such as a parent item. It can be dependent on child items.
     * @param docWrapper
     */
    getWidth(docWrapper: PdfDocWrapperContract): number | undefined;

    /**
     * The minimum width of the item
     * @param docWrapper
     */
    getMinWidth?(docWrapper: PdfDocWrapperContract): number | undefined;

    /**
     * Returns the fonts that should be registered before drawing the item.
     */
    getFonts?(): PdfFont[];
}
