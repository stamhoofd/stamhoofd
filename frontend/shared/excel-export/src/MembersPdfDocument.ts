import logoUrl from '@stamhoofd/assets/images/logo/logo-horizontal.png';
import { PlatformMember } from '@stamhoofd/structures';
import { colorDark } from './pdf-builder/colors';
import { metropolisBold, metropolisMedium } from './pdf-builder/fonts';
import { PdfFont } from './pdf-builder/pdf-font';
import { mmToPoints } from './pdf-builder/pdf-helpers';
import { PdfItem, PdfItemDrawOptions } from './pdf-builder/pdf-item';
import { DefaultText } from './pdf-builder/pdf-items/DefaultText';
import { H1 } from './pdf-builder/pdf-items/H1';
import { H3 } from './pdf-builder/pdf-items/H3';
import { LabelWithValue } from './pdf-builder/pdf-items/LabelWithValue';
import { Logo } from './pdf-builder/pdf-items/Logo';
import { HorizontalGrid } from './pdf-builder/pdf-items/PdfHorizontalGrid';
import { PdfText } from './pdf-builder/pdf-items/PdfText';
import { Spacing } from './pdf-builder/pdf-items/Spacing';
import { VerticalStack } from './pdf-builder/pdf-items/VerticalStack';
import { PdfRenderer } from './pdf-builder/pdf-renderer';
import { SelectablePdfColumn } from './SelectablePdfColumn';

const pageMargin = mmToPoints(10);

export class MembersPdfDocument {
    constructor(private readonly items: PlatformMember[], private readonly memberDetailsSelectableColumns: SelectablePdfColumn<PlatformMember>[], private readonly title: string) {
    }

    private async createDoc(): Promise<PDFKit.PDFDocument> {
        const PDFDocument = (await import('pdfkit/js/pdfkit.standalone')).default as PDFKit.PDFDocument;
        return new PDFDocument({ size: 'A4', margin: pageMargin, bufferPages: true });
    }

    private async render() {
        const items: PdfItem[] = [];

        const logo = new Logo({ src: await (await fetch(logoUrl as string)).arrayBuffer(), width: mmToPoints(30) });
        items.push(logo);

        const documentTitle = new H1(this.title, {
            position: {
                x: pageMargin,
                y: pageMargin,
            },
            spacing: {
                bottom: mmToPoints(2),
            },
        });
        items.push(documentTitle);

        const documentDescription = new DefaultText($t('Bewaar dit document op een veilige plaats en vernietig het na gebruik.'), {
            spacing: {
                bottom: mmToPoints(4),
            },
        });
        items.push(documentDescription);

        const grid = new MembersHorizontalGrid({
            objects: this.items.sort(PlatformMember.sorterByName('ASC')),
            columns: 2,
            selectableColumns: this.memberDetailsSelectableColumns,
            getName: (o: PlatformMember) => o.patchedMember.details.name,
        });
        items.push(grid);

        const renderer = new PdfRenderer();
        const doc = await this.createDoc();
        return renderer.render(doc, items);
    }

    async download() {
        return (await this.render()).download('Stamhoofd');
    }
}

interface MembersHorizontalGridArgs<T> {
    objects: T[];
    columns: number;
    selectableColumns: SelectablePdfColumn<T>[];
    getName: (o: T) => string;
}

class MembersHorizontalGrid<T> implements PdfItem {
    private readonly factory: (doc: PDFKit.PDFDocument) => HorizontalGrid;

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

function membersHorizontalGridFactory<T>({ objects, columns, selectableColumns, getName }: MembersHorizontalGridArgs<T>): (doc: PDFKit.PDFDocument) => HorizontalGrid {
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

        const grid = new HorizontalGrid(containers, {
            columns,
            columnGap: mmToPoints(10),
            rowGap: mmToPoints(5),
        });

        return grid;
    };
}
