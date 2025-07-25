import { PdfDocWrapper } from '../PdfDocWrapper';
import { PdfFont } from '../PdfFont';
import { PdfItem, PdfItemDrawOptions, PdfItemGetHeightOptions } from '../PdfItem';
import { VerticalStack } from './VerticalStack';

export interface PdfHorizontalGridOptions {
    /**
     * The number of columns. If set to 'auto', the number of columns will be calculated automatically based on the width / min-width of the items.
     */
    columns: number | 'auto';

    /**
     * Spacing between columns
     */
    columnGap?: number;

    /**
     * Spacing between rows
     */
    rowGap?: number;

    /**
     * Max width of the grid
     */
    maxWidth?: number;
}

/**
 * Draws the child items in columns from left to right with the specified number of columns, columnGap, rowGap and width.
 * It is possible to pass a single VerticalStack: the stack will be splitted automatically. This way the vertical stack will be drawn in columns starting from the top until the end of the page, from left to right (if the end of the page is reached the item in the stack will be drawn in the next column).
 */
export class HorizontalGrid implements PdfItem {
    // number of columns
    private readonly columns: number | 'auto';

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

    private getColumns(docWrapper: PdfDocWrapper, availableWidth: number): number {
        if (this.columns !== 'auto') {
            return this.columns;
        }

        return this.calculateAutoColumns(docWrapper, availableWidth);
    }

    /**
     * Calculate the number of columns based on the width of the items and the available width.
     * @param docWrapper
     * @param availableWidth
     * @returns
     */
    private calculateAutoColumns(docWrapper: PdfDocWrapper, availableWidth: number): number {
        let columns = 1;
        let totalItems = 0;
        let maxItemWidth = 0;

        // calculate the width of the widest item and count the total number of items
        for (const item of this.items) {
            const width = item.getMinWidth ? item.getMinWidth(docWrapper) : item.getWidth(docWrapper);
            if (width === undefined) {
                // if width is undefined, we can't calculate the max width
                return 1;
            }

            if (width > maxItemWidth) {
                maxItemWidth = Math.ceil(width);
            }

            if (item instanceof VerticalStack && item.isAllowedToSplit) {
                totalItems += item.size;
            }
            else {
                totalItems++;
            }
        }

        let totalWidthIfNextColumn = Math.ceil(2 * maxItemWidth + this.columnGap);

        // if enough space
        while (totalWidthIfNextColumn < availableWidth) {
            // add another column
            columns++;
            // calculate the total width if another column would be added
            totalWidthIfNextColumn = Math.ceil(totalWidthIfNextColumn + maxItemWidth + this.columnGap);
        }

        // the total number of columns can't exceed the total number of items
        return Math.min(totalItems, columns);
    }

    draw(docWrapper: PdfDocWrapper, options: PdfItemDrawOptions = {}): void {
        if (this.items.length === 0) {
            return;
        }

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

        const columns = this.getColumns(docWrapper, maxWidth);

        const columnWidth = (maxWidth - (this.columnGap * (columns - 1))) / columns;
        const getHeightOptions: PdfItemGetHeightOptions = { maxWidth: columnWidth };

        const originalX = x;
        let currentColumn = 0;
        let didCurrentRowOverflow = false;
        let heightOfHighestItemOnRow = 0;
        let rowTop = y;
        let shouldGoToNextPage = false;
        let pageTop = rowTop;

        const setX = (newX: number) => {
            x = newX;
            doc.x = x;
        };

        const setY = (newY: number) => {
            y = newY;
            doc.y = y;
        };

        const goToNextRow = (newY: number) => {
            setY(newY);
            currentColumn = 0;
            rowTop = y;
            setX(originalX);
            heightOfHighestItemOnRow = 0;
            didCurrentRowOverflow = false;
        };

        const goToNextPage = () => {
            pageTop = docWrapper.safeMargins.top;
            docWrapper.goToNextPage();
            goToNextRow(docWrapper.safeMargins.top);
        };

        /**
         * Draw the items.
         * Calls itself recursively if a container is split.
         * @param items
         */
        const drawItems = (items: PdfItem[], isLastBatch: boolean) => {
            for (let i = 0; i < items.length; i++) {
                const item = items[i];

                // go to next page if a new page is needed after the previous item
                if (shouldGoToNextPage) {
                    shouldGoToNextPage = false;
                    goToNextPage();
                }

                // first calculate height to check if the item will fit on the current page
                const itemHeight = item.getHeight(docWrapper, getHeightOptions);

                const pageBottomLimit = doc.page.height - docWrapper.safeMargins.bottom;
                const totalAvailableHeightOnPage = Math.floor(pageBottomLimit - pageTop);
                const heightExceedsTotalAvailableHeightOnPage = itemHeight > totalAvailableHeightOnPage;
                const availableHeight = pageBottomLimit - rowTop;

                const isLastItemInBatch = i === items.length - 1;
                const isCurrentLastItem = isLastBatch && isLastItemInBatch;

                // maximize the use of the available height on the page by splitting the last item
                if (columns > 1 && isCurrentLastItem && currentColumn === 0 && itemHeight / columns < totalAvailableHeightOnPage) {
                    if (item instanceof VerticalStack && item.isAllowedToSplit) {
                        const itemsToDraw = item.splitInEqualParts(docWrapper, getHeightOptions, columns);
                        drawItems(itemsToDraw, isCurrentLastItem);
                        continue;
                    }
                }

                // if the item height exceeds the page height, split the item
                if (heightExceedsTotalAvailableHeightOnPage) {
                    didCurrentRowOverflow = true;
                    if (item instanceof VerticalStack) {
                        const itemsToDraw = item.split(docWrapper, getHeightOptions, totalAvailableHeightOnPage);

                        drawItems(itemsToDraw, isCurrentLastItem);
                        continue;
                    }
                    console.warn('Item height exceeds page height');
                }

                // go to the next page if the item will not fit
                if (itemHeight > availableHeight) {
                    goToNextPage();
                }

                item.draw(docWrapper, { ...options, maxWidth: columnWidth, position: { x, y } });

                if (itemHeight > heightOfHighestItemOnRow) {
                    heightOfHighestItemOnRow = itemHeight;
                }

                currentColumn = (currentColumn + 1) % columns;
                const isLastItemInGrid = isLastBatch && i === items.length - 1;

                if (isLastItemInGrid) {
                    goToNextRow(rowTop + heightOfHighestItemOnRow);
                }
                else if (currentColumn === 0) {
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
                    setX(originalX + (currentColumn * (this.columnGap + columnWidth)));
                }
            }
        };

        drawItems(this.items, true);
    }

    getHeight(docWrapper: PdfDocWrapper, options: PdfItemGetHeightOptions): number {
        let totalHeight: number = 0;

        if (this.items.length === 0) {
            return totalHeight;
        }

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

        const columns = this.getColumns(docWrapper, maxWidth);

        const columnWidth = (maxWidth - (this.columnGap * (columns - 1))) / columns;
        const getHeightOptions: PdfItemGetHeightOptions = { maxWidth: columnWidth };

        const originalX = x;
        let currentColumn = 0;
        let didCurrentRowOverflow = false;
        let heightOfHighestItemOnRow = 0;
        let rowTop = y;
        let shouldGoToNextPage = false;
        let pageTop = rowTop;

        const setX = (newX: number) => {
            x = newX;
        };

        const setY = (newY: number) => {
            y = newY;
        };

        const goToNextRow = (newY: number) => {
            const originalY = y;
            setY(newY);
            currentColumn = 0;
            rowTop = y;
            setX(originalX);

            if (newY > originalY) {
                totalHeight += newY - originalY;
            }
            else {
                totalHeight += newY - docWrapper.safeMargins.top;
            }

            heightOfHighestItemOnRow = 0;
            didCurrentRowOverflow = false;
        };

        const goToNextPage = () => {
            pageTop = docWrapper.safeMargins.top;
            goToNextRow(docWrapper.safeMargins.top);
        };

        /**
         * Add the height of items.
         * Calls itself recursively if a container is split.
         * @param items
         */
        const addHeightOfItems = (items: PdfItem[], isLastBatch: boolean) => {
            for (let i = 0; i < items.length; i++) {
                const item = items[i];

                // go to next page if a new page is needed after the previous item
                if (shouldGoToNextPage) {
                    shouldGoToNextPage = false;
                    goToNextPage();
                }

                // first calculate height to check if the item will fit on the current page
                const itemHeight = item.getHeight(docWrapper, getHeightOptions);

                const pageBottomLimit = doc.page.height - docWrapper.safeMargins.bottom;
                const totalAvailableHeightOnPage = Math.floor(pageBottomLimit - pageTop);
                const heightExceedsTotalAvailableHeightOnPage = itemHeight > totalAvailableHeightOnPage;
                const availableHeight = pageBottomLimit - rowTop;

                const isLastItemInBatch = i === items.length - 1;
                const isCurrentLastItem = isLastBatch && isLastItemInBatch;

                // maximize the use of the available height on the page by splitting the last item
                if (columns > 1 && isCurrentLastItem && currentColumn === 0 && itemHeight / columns < totalAvailableHeightOnPage) {
                    if (item instanceof VerticalStack && item.isAllowedToSplit) {
                        const itemsToDraw = item.splitInEqualParts(docWrapper, getHeightOptions, columns);
                        addHeightOfItems(itemsToDraw, isCurrentLastItem);
                        continue;
                    }
                }

                // if the item height exceeds the page height, split the item
                if (heightExceedsTotalAvailableHeightOnPage) {
                    didCurrentRowOverflow = true;
                    if (item instanceof VerticalStack) {
                        const itemsToDraw = item.split(docWrapper, getHeightOptions, totalAvailableHeightOnPage);

                        addHeightOfItems(itemsToDraw, isCurrentLastItem);
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

                currentColumn = (currentColumn + 1) % columns;
                const isLastItemInGrid = isLastBatch && i === items.length - 1;

                if (isLastItemInGrid) {
                    goToNextRow(rowTop + heightOfHighestItemOnRow);
                }
                else if (currentColumn === 0) {
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
                    setX(originalX + (currentColumn * (this.columnGap + columnWidth)));
                }
            }
        };

        addHeightOfItems(this.items, true);

        return totalHeight;
    }

    getWidth(docWrapper: PdfDocWrapper): number {
        return this.maxWidth === undefined ? docWrapper.getPageWidthWithoutMargins() : this.maxWidth;
    }

    getFonts(): PdfFont[] {
        return this.items.flatMap(item => item.getFonts ? item.getFonts() : []);
    }
}
