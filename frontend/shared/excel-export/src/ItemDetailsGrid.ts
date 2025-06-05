// todo: rename and move
import { PdfDocument } from '@stamhoofd/frontend-excel-export/src/PdfDocuments';
import { SelectablePdfColumn } from '@stamhoofd/frontend-excel-export/src/SelectablePdfColumn';
import { colorDark, colorGray } from './pdf-builder/colors';
import { metropolisBold, metropolisMedium } from './pdf-builder/fonts';
import { getLastPageNumber, mmToPoints } from './pdf-builder/pdf-helpers';
import { PdfItem } from './pdf-builder/pdf-item';
import { DefaultText } from './pdf-builder/pdf-items/DefaultText';
import { H3 } from './pdf-builder/pdf-items/H3';

export interface ItemDetailsGridOptions {
    maxWidth?: number;
    gridStyle?: {
        columnGap?: number;
        rowGap?: number;
        columns?: number;
    };
    itemStyle?: {
        columnGap?: number;
        rowGap?: number;
    };
}

export class ItemDetailsGrid<T> implements PdfItem {
    private columns: SelectablePdfColumn<T>[];
    private columnWidth = 0;
    private labelWidth = 0;
    private valueWidth = 0;

    private readonly maxWidth?: number;
    private readonly itemStyle: Required<Required<ItemDetailsGridOptions>['itemStyle']>;
    private readonly gridStyle: Required<Required<ItemDetailsGridOptions>['gridStyle']>;

    constructor(private readonly document: PdfDocument<T>, private readonly items: T[], options: ItemDetailsGridOptions = {}) {
        this.maxWidth = options.maxWidth;

        this.itemStyle = {
            columnGap: options.itemStyle?.columnGap === undefined ? mmToPoints(2) : options.itemStyle.columnGap,
            rowGap: options.itemStyle?.rowGap === undefined ? mmToPoints(0.75) : options.itemStyle.rowGap,
        };

        this.gridStyle = {
            columnGap: options.gridStyle?.columnGap === undefined ? mmToPoints(10) : options.gridStyle.columnGap,
            rowGap: options.gridStyle?.rowGap === undefined ? mmToPoints(5) : options.gridStyle.rowGap,
            columns: 2,
        };
    }

    getHeight(doc: PDFKit.PDFDocument): number {
        throw new Error('Method not implemented.');
    }

    getWidth(doc: PDFKit.PDFDocument): number {
        throw new Error('Method not implemented.');
    }

    getFonts() {
        return [metropolisMedium, metropolisBold];
    }

    private init(doc: PDFKit.PDFDocument) {
        // set columns
        this.columns = this.document.items.filter(item => item.enabled);

        // calculate label width
        const longestLabel = this.columns.map(item => item.name).reduce((a, b) => a.length > b.length ? a : b, '');
        const margins = doc.page.margins;
        const defaultMaxWidth = doc.page.width - (margins.left + margins.right);
        const maxWidth = this.maxWidth === undefined ? defaultMaxWidth : Math.min(this.maxWidth, defaultMaxWidth);
        this.columnWidth = (maxWidth - (this.gridStyle.columnGap * (this.gridStyle.columns - 1))) / this.gridStyle.columns;
        const maxLabelWidth = this.columnWidth / 2;
        this.labelWidth = Math.min(maxLabelWidth, this.createLabel(longestLabel).getWidth(doc));
        this.valueWidth = this.columnWidth - this.labelWidth;
    }

    private createTitle(item: T) {
        return new H3(this.document.getItemName(item), { width: this.columnWidth });
    }

    private createLabel(text: string) {
        return new DefaultText(text, { fillColor: colorGray, width: this.labelWidth });
    }

    private createValueText(item: T, column: SelectablePdfColumn<T>) {
        const value = column.getStringValue(item);
        const isEmpty = value.length === 0;
        return new DefaultText(isEmpty ? '/' : value, { width: this.valueWidth, fillColor: isEmpty ? colorGray : colorDark });
    }

    /**
     * Calculate the height that the item will take when rendered
     * @param doc
     * @param item
     * @returns
     */
    private calculateItemHeight(doc: PDFKit.PDFDocument, item: T): number {
        let totalHeight = 0;

        const goToNextLine = () => {
            totalHeight += mmToPoints(this.itemStyle.rowGap);
        };

        const title = this.createTitle(item);
        totalHeight += title.getHeight(doc);
        goToNextLine();

        for (const column of this.columns) {
            // label
            const labelHeight = this.createLabel(column.name)
                .getHeight(doc);

            // value
            const valueHeight = this.createValueText(item, column)
                .getHeight(doc);

            totalHeight += Math.max(labelHeight, valueHeight);

            goToNextLine();
        }

        return totalHeight;
    }

    private drawItem(doc: PDFKit.PDFDocument, item: T, { x, y }: { x: number; y: number }) {
        // do not forget to change calculateItemHeight if the layout changes
        const goToNextLine = () => {
            y = doc.y + mmToPoints(this.itemStyle.rowGap);
        };

        const title = this.createTitle(item);
        title.draw(doc, { x, y });
        goToNextLine();

        for (const column of this.columns) {
            // label
            this.createLabel(column.name)
                .draw(doc, { x, y });

            // value
            this.createValueText(item, column)
                .draw(doc, { x: x + this.labelWidth + this.itemStyle.columnGap, y });

            goToNextLine();
        }
    }

    draw(doc: PDFKit.PDFDocument, position: { x?: number; y?: number } = {}) {
        this.init(doc);

        let x = position.x === undefined ? doc.x : position.x;
        let y = position.y === undefined ? doc.y : position.y;

        const originalX = x;
        let currentPageNumber = getLastPageNumber(doc) - 1;
        let currentColumn = 0;
        let currentRow = 0;
        let heightOfHighestItemOnRow = 0;
        let rowTop = y;

        const goToNextRow = (newY: number) => {
            y = newY;
            currentColumn = 0;
            currentRow++;
            rowTop = y;
            x = originalX;
            heightOfHighestItemOnRow = 0;
        };

        for (const item of this.items) {
            // first calculate height to check if the item will fit on the current page
            const itemHeight = this.calculateItemHeight(doc, item);

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

            this.drawItem(doc, item, { x, y });

            currentColumn = (currentColumn + 1) % this.gridStyle.columns;
            if (currentColumn === 0) {
                goToNextRow(heightOfHighestItemOnRow + rowTop + this.gridStyle.rowGap);
            }
            else {
                x = originalX + (currentColumn * (this.gridStyle.columnGap + this.columnWidth));
            }
        }
    }
}
