import { PdfDocWrapper } from '../pdf-doc-wrapper';
import { PdfFont } from '../pdf-font';
import { getPageHeighthWithoutMargins } from '../pdf-helpers';
import { PdfItem, PdfItemDrawOptions, PdfItemGetHeightOptions } from '../pdf-item';
import { VerticalStack } from './VerticalStack';

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
export class HorizontalGrid implements PdfItem {
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

    draw(docWrapper: PdfDocWrapper, options: PdfItemDrawOptions = {}): void {
        const doc = docWrapper.doc;

        let { x, y } = docWrapper.getNextPosition(options);

        const maxPageWidth = docWrapper.getPageWidthWithoutMargins();

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
        let currentPageNumber = docWrapper.getLastPageNumber() - 1;
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
                const itemHeight = item.getHeight(docWrapper, getHeightOptions);

                const pageBottomLimit = doc.page.height - doc.page.margins.bottom;
                const heightExceedsPageHeight = itemHeight > getPageHeighthWithoutMargins(doc);
                const availableHeight = pageBottomLimit - rowTop;

                // if the item height exceeds the page height, split the item
                if (heightExceedsPageHeight) {
                    didCurrentRowOverflow = true;
                    if (item instanceof VerticalStack) {
                        const splitItems = item.split(docWrapper, getHeightOptions, availableHeight);
                        drawItems(splitItems);
                        continue;
                    }
                    console.warn('Item height exceeds page height');
                }

                if (itemHeight > heightOfHighestItemOnRow) {
                    heightOfHighestItemOnRow = itemHeight;
                }

                // go to the next page if the item will not fit
                if (itemHeight > availableHeight) {
                    goToNextPage();
                }

                item.draw(docWrapper, { ...options, maxWidth: columnWidth, position: { x, y } });

                currentColumn = (currentColumn + 1) % this.columns;
                if (currentColumn === 0) {
                    if (didCurrentRowOverflow) {
                        // do not go to next page immediatetely because ony needed if there is another item
                        shouldGoToNextPage = true;
                    }
                    else {
                        const nextRowTop = rowTop + this.rowGap + heightOfHighestItemOnRow;

                        // if next row is below the bottom of the page, go to next page
                        if (nextRowTop > pageBottomLimit) {
                            shouldGoToNextPage = true;
                        }
                        // else go to next row
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

    getHeight(_docWrapper: PdfDocWrapper): number {
        throw new Error('Method not implemented.');
    }

    getWidth(docWrapper: PdfDocWrapper): number {
        return this.maxWidth === undefined ? docWrapper.getPageWidthWithoutMargins() : this.maxWidth;
    }

    getFonts(): PdfFont[] {
        return this.items.flatMap(item => item.getFonts ? item.getFonts() : []);
    }
}
