import { metropolisBold, metropolisMedium } from './pdf-builder/fonts';
import { PdfFont } from './pdf-builder/pdf-font';
import { mmToPoints } from './pdf-builder/pdf-helpers';
import { PdfItem, PdfItemDrawOptions } from './pdf-builder/pdf-item';
import { H3 } from './pdf-builder/pdf-items/H3';
import { LabelWithValue } from './pdf-builder/pdf-items/LabelWithValue';
import { PdfContainer } from './pdf-builder/pdf-items/PdfContainer';
import { PdfHorizontalGrid } from './pdf-builder/pdf-items/PdfHorizontalGrid';
import { Spacing } from './pdf-builder/pdf-items/Spacing';
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
            const spacing = new Spacing(mmToPoints(2));

            const values = enabledColumns.flatMap((c) => {
                const labelWithValue = new LabelWithValue({
                    label: {
                        text: c.name,
                        minWidth: minLabelWidth,
                    },
                    value: {
                        text: c.getStringValue(o),
                    },
                    gapBetween: mmToPoints(2),
                });

                return [labelWithValue, spacing];
            });

            const container = new PdfContainer([
                title,
                spacing,
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
