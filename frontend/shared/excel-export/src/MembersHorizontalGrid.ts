import { colorDark } from './pdf-builder/colors';
import { metropolisBold, metropolisMedium } from './pdf-builder/fonts';
import { PdfFont } from './pdf-builder/pdf-font';
import { mmToPoints } from './pdf-builder/pdf-helpers';
import { PdfItem, PdfItemDrawOptions } from './pdf-builder/pdf-item';
import { H3 } from './pdf-builder/pdf-items/H3';
import { LabelWithValue } from './pdf-builder/pdf-items/LabelWithValue';
import { PdfHorizontalGrid } from './pdf-builder/pdf-items/PdfHorizontalGrid';
import { PdfText } from './pdf-builder/pdf-items/PdfText';
import { Spacing } from './pdf-builder/pdf-items/Spacing';
import { VerticalStack } from './pdf-builder/pdf-items/VerticalStack';
import { SelectablePdfColumn } from './SelectablePdfColumn';

export interface MembersHorizontalGridArgs<T> {
    objects: T[];
    columns: number;
    selectableColumns: SelectablePdfColumn<T>[];
    getName: (o: T) => string;
}

export class MembersHorizontalGrid<T> implements PdfItem {
    private readonly factory: (doc: PDFKit.PDFDocument) => PdfHorizontalGrid;

    constructor(private readonly args: MembersHorizontalGridArgs<T>) {
        this.factory = membersHorizontalGridFactory(this.args);
    }

    private createGrid(doc: PDFKit.PDFDocument) {
        return this.factory(doc);
    }

    draw(doc: PDFKit.PDFDocument, options?: PdfItemDrawOptions): void {
        const grid = this.createGrid(doc);
        grid.draw(doc, options);
    }

    getHeight(doc: PDFKit.PDFDocument): number {
        const grid = this.createGrid(doc);
        return grid.getHeight(doc);
    }

    getWidth(doc: PDFKit.PDFDocument): number | undefined {
        const grid = this.createGrid(doc);
        return grid.getWidth(doc);
    }

    getFonts(): PdfFont[] {
        return [metropolisMedium, metropolisBold];
    }
}

function membersHorizontalGridFactory<T>({ objects, columns, selectableColumns, getName }: MembersHorizontalGridArgs<T>): (doc: PDFKit.PDFDocument) => PdfHorizontalGrid {
    const enabledColumns = selectableColumns.filter(c => c.enabled);
    const labels = enabledColumns.map(c => c.name);
    const longestLabel = labels.reduce((a, b) => a.length > b.length ? a : b, '');

    return (doc: PDFKit.PDFDocument) => {
        const minLabelWidth = LabelWithValue.widthOfLabel(doc, longestLabel);

        const containers = objects.map((o) => {
            const title = new H3(getName(o));
            const spacing4mm = new Spacing(mmToPoints(4));
            const spacing2mm = new Spacing(mmToPoints(2));
            const spacing1mm = new Spacing(mmToPoints(1));

            let currentCategory: string | undefined = undefined;

            const values = enabledColumns.flatMap((c) => {
                const result: PdfItem[] = [];

                if (c.category) {
                    // if new category
                    if (c.category !== currentCategory) {
                        result.push(spacing2mm);
                        const subTitle = new PdfText(c.category, { font: metropolisBold, fontSize: 9, fillColor: colorDark, align: 'left' });
                        result.push(subTitle);
                        result.push(spacing2mm);
                        currentCategory = c.category;
                    }
                }
                else {
                    // if end of category
                    if (currentCategory !== undefined) {
                        result.push(spacing2mm);
                    }
                    currentCategory = undefined;
                }

                const labelWithValue = new LabelWithValue({
                    label: {
                        text: c.name,
                        minWidth: minLabelWidth,
                    },
                    value: {
                        text: c.getStringValue(o),
                    },
                    gapBetween: mmToPoints(2),
                    // lineGap of 1mm (for small spacing between lines of the value and label text)
                    lineGap: mmToPoints(1),
                });
                result.push(labelWithValue);

                // extra spacing of 1mm (already 1mm of lineGap, => total 2mm)
                result.push(spacing1mm);

                return result;
            });

            const container = new VerticalStack([
                title,
                spacing4mm,
                ...values,
            ]);

            return container;
        });

        const grid = new PdfHorizontalGrid(containers, {
            columns,
            columnGap: mmToPoints(10),
            rowGap: mmToPoints(5),
        });

        return grid;
    };
}
