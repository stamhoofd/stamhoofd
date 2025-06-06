import { PdfFont } from '../pdf-font';
import { getLastPageNumber, getPageHeighthWithoutMargins, getPageWidthWithoutMargins } from '../pdf-helpers';
import { PdfItem, PdfItemDrawOptions, PdfItemGetHeightOptions } from '../pdf-item';
import { PdfContainer } from './PdfContainer';

export interface PdfHorizontalGridOptions {
    columns: number;
    columnGap?: number;
    rowGap?: number;
    maxWidth?: number;
}

/**
 * A horizontal grid of items: draws the items in columns
 * with the specified number of columns, columnGap, rowGap and width.
 */
export class PdfHorizontalGrid implements PdfItem {
    // number of columns
    private readonly columns: number;

    // spacing between columns
    private readonly columnGap: number;

    // spacing between rows
    private readonly rowGap: number;

    // max width of the grid
    private readonly maxWidth?: number;

    constructor(private readonly items: PdfItem[], options: PdfHorizontalGridOptions) {
        this.columns = options.columns;
        this.columnGap = options.columnGap ?? 0;
        this.rowGap = options.rowGap ?? 0;
        this.maxWidth = options.maxWidth;
    }

    draw(doc: PDFKit.PDFDocument, options: PdfItemDrawOptions = {}): void {
        const position = options.position;

        let x = position?.x === undefined ? doc.x : position.x;
        let y = position?.y === undefined ? doc.y : position.y;
        const maxPageWidth = getPageWidthWithoutMargins(doc);

        const widths: number[] = [maxPageWidth];
        if (this.maxWidth) {
            widths.push(this.maxWidth);
        }
        if (options?.maxWidth !== undefined) {
            widths.push(options.maxWidth);
        }
        const maxWidth = Math.min(...widths);

        const columnWidth = (maxWidth - (this.columnGap * (this.columns - 1))) / this.columns;
        const getHeightOptions: PdfItemGetHeightOptions = { maxWidth: columnWidth };

        const originalX = x;
        let currentPageNumber = getLastPageNumber(doc) - 1;
        let currentColumn = 0;
        let didCurrentRowOverflow = false;
        let heightOfHighestItemOnRow = 0;
        let rowTop = y;
        let shouldGoToNextPage = false;

        const goToNextRow = (newY: number) => {
            y = newY;
            currentColumn = 0;
            rowTop = y;
            x = originalX;
            heightOfHighestItemOnRow = 0;
            didCurrentRowOverflow = false;
        };

        const goToNextPage = () => {
            doc.addPage();
            doc.switchToPage(currentPageNumber + 1);
            currentPageNumber++;
            goToNextRow(doc.page.margins.top);
        };

        let count = 1;

        /**
         * Draw the items.
         * Calls itself recursively if a container is split.
         * @param items
         */
        const drawItems = (items: PdfItem[]) => {
            for (const item of items) {
                // go to next page if a new page is needed after the previous item
                if (shouldGoToNextPage) {
                    shouldGoToNextPage = false;
                    goToNextPage();
                }

                // first calculate height to check if the item will fit on the current page
                const itemHeight = item.getHeight(doc, getHeightOptions);

                const pageBottomLimit = doc.page.height - doc.page.margins.bottom;
                const heightExceedsPageHeight = itemHeight > getPageHeighthWithoutMargins(doc);
                const availableHeight = pageBottomLimit - rowTop;

                if (heightExceedsPageHeight) {
                    didCurrentRowOverflow = true;
                    if (item instanceof PdfContainer) {
                        console.log(`column: ${currentColumn}, page height: ${doc.page.height}, rowTop: ${rowTop}, margin bottom: ${doc.page.margins.bottom}`);
                        const splitItems = item.splitVertical(doc, getHeightOptions, availableHeight);
                        drawItems(splitItems);
                        continue;
                    }
                    console.warn('Item height exceeds page height');
                }

                console.log(`item ${count}`);
                count++;

                if (itemHeight > heightOfHighestItemOnRow) {
                    heightOfHighestItemOnRow = itemHeight;
                }

                // go to the next page if the item will not fit
                if (itemHeight > availableHeight) {
                    console.log(`next page: not enough space for item (itemHeight: ${itemHeight}, availableHeight: ${availableHeight})`);
                    goToNextPage();
                }

                item.draw(doc, { ...options, maxWidth: columnWidth, position: { x, y } });

                currentColumn = (currentColumn + 1) % this.columns;
                if (currentColumn === 0) {
                    if (didCurrentRowOverflow) {
                        // do not go to next page immediatetely because ony needed if there is another item
                        console.log('next page: current row did overFlow');
                        shouldGoToNextPage = true;
                    }
                    else {
                        console.log('next row');
                        const nextRowTop = rowTop + this.rowGap + heightOfHighestItemOnRow;

                        if (nextRowTop > pageBottomLimit) {
                            console.log('next page: page bottom limit exceeded');
                            shouldGoToNextPage = true;
                        }
                        else {
                            goToNextRow(nextRowTop);
                        }
                    }
                }
                else {
                    x = originalX + (currentColumn * (this.columnGap + columnWidth));
                }
            }
        };

        drawItems(this.items);
    }

    getHeight(_doc: PDFKit.PDFDocument): number {
        throw new Error('Method not implemented.');
        // return this.items.reduce((acc, item) => acc + item.getHeight(doc), 0);
    }

    getWidth(doc: PDFKit.PDFDocument): number {
        return this.maxWidth === undefined ? getPageWidthWithoutMargins(doc) : this.maxWidth;
    }

    getFonts(): PdfFont[] {
        return this.items.flatMap(item => item.getFonts ? item.getFonts() : []);
    }
}
