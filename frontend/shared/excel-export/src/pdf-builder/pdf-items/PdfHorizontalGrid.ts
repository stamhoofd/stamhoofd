import { PdfFont } from '../pdf-font';
import { getLastPageNumber, getPageWidthWithoutMargins } from '../pdf-helpers';
import { PdfItem, PdfItemDrawOptions } from '../pdf-item';

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

    draw(doc: PDFKit.PDFDocument, options?: PdfItemDrawOptions): void {
        const position = options?.position;

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

        const originalX = x;
        let currentPageNumber = getLastPageNumber(doc) - 1;
        let currentColumn = 0;
        let heightOfHighestItemOnRow = 0;
        let rowTop = y;

        const goToNextRow = (newY: number) => {
            y = newY;
            currentColumn = 0;
            rowTop = y;
            x = originalX;
            heightOfHighestItemOnRow = 0;
        };

        for (const item of this.items) {
            // first calculate height to check if the item will fit on the current page
            const itemHeight = item.getHeight(doc);

            if (itemHeight > heightOfHighestItemOnRow) {
                heightOfHighestItemOnRow = itemHeight;
            }

            // go to the next page if the item will not fit
            if (rowTop + itemHeight > doc.page.height - doc.page.margins.bottom) {
                doc.addPage();
                doc.switchToPage(currentPageNumber + 1);
                currentPageNumber++;
                goToNextRow(doc.page.margins.top);
            }

            // todo: what if item will not fit on 1 page?
            item.draw(doc, { ...options, position: { x, y } });

            currentColumn = (currentColumn + 1) % this.columns;
            if (currentColumn === 0) {
                goToNextRow(heightOfHighestItemOnRow + rowTop + this.rowGap);
            }
            else {
                x = originalX + (currentColumn * (this.columnGap + columnWidth));
            }
        }
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
