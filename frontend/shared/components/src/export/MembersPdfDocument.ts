import logoUrl from '@stamhoofd/assets/images/logo/logo-horizontal.png';
import { colorDark, DefaultText, H1, H3, HorizontalGrid, LabelWithValue, Logo, metropolisBold, metropolisMedium, mmToPoints, PdfDocWrapper, PdfFont, PdfItem, PdfItemDrawOptions, PdfRenderer, PdfText, Spacing, VerticalStack } from '@stamhoofd/frontend-pdf-builder';
import { PlatformMember } from '@stamhoofd/structures';
import { MembersSummaryHorizontalGrid } from './MembersSummaryHorizontalGrid';
import { PdfDocument } from './PdfDocuments';
import { SelectablePdfData } from './SelectablePdfData';

const pageMargin = mmToPoints(10);

export class MembersPdfDocument {
    constructor(private readonly items: PlatformMember[], private readonly memberDetailsDocument: PdfDocument<PlatformMember>, private readonly membersSummaryDocument: PdfDocument<PlatformMember>, private readonly title: string) {
    }

    private async createDoc(): Promise<PDFKit.PDFDocument> {
        const PDFDocument = (await import('pdfkit/js/pdfkit.standalone')).default as PDFKit.PDFDocument;
        return new PDFDocument({ size: 'A4', margin: pageMargin, bufferPages: true });
    }

    private async render() {
        const items: PdfItem[] = [];

        // logo
        const logo = new Logo({ src: await (await fetch(logoUrl as string)).arrayBuffer(), width: mmToPoints(30) });
        items.push(logo);

        // title
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

        // description
        const documentDescription = new DefaultText($t('Bewaar dit document op een veilige plaats en vernietig het na gebruik.'), {
            spacing: {
                bottom: mmToPoints(4),
            },
        });
        items.push(documentDescription);

        const sortedMembers = [...this.items].sort(PlatformMember.sorterByName('ASC'));

        // member details
        if (this.memberDetailsDocument.enabled) {
            const grid = new MembersDetailHorizontalGrid({
                members: sortedMembers,
                columns: 2,
                selectableColumns: this.memberDetailsDocument.items,
                getName: (o: PlatformMember) => o.patchedMember.details.name,
            });
            items.push(grid);
        }

        // member summary
        if (this.membersSummaryDocument.enabled) {
            this.membersSummaryDocument.items.forEach((selectableColumn) => {
                if (!selectableColumn.enabled) {
                    return;
                }

                const summaryTitle = new H3(selectableColumn.name, {
                    spacing: {
                        bottom: mmToPoints(2),
                    },
                });
                items.push(summaryTitle);

                const summaryGrid = new MembersSummaryHorizontalGrid({
                    members: sortedMembers,
                    columns: 2,
                    selectableColumn,
                    getName: (o: PlatformMember) => o.patchedMember.details.name,
                });

                items.push(summaryGrid);
            });
        }

        // render
        const renderer = new PdfRenderer();
        const doc = await this.createDoc();
        return renderer.render(doc, items);
    }

    async download() {
        return (await this.render()).download('Stamhoofd');
    }
}

interface MembersHorizontalGridArgs {
    members: PlatformMember[];
    columns: number;
    selectableColumns: SelectablePdfData<PlatformMember>[];
    getName: (member: PlatformMember) => string;
}

/**
 * A horizontal grid of member details
 */
class MembersDetailHorizontalGrid implements PdfItem {
    private readonly factory: (docWrapper: PdfDocWrapper) => HorizontalGrid;

    constructor(private readonly args: MembersHorizontalGridArgs) {
        this.factory = createMembersDetailHorizontalGridFactory(this.args);
    }

    private createGrid(docWrapper: PdfDocWrapper) {
        return this.factory(docWrapper);
    }

    draw(docWrapper: PdfDocWrapper, options?: PdfItemDrawOptions): void {
        const grid = this.createGrid(docWrapper);
        grid.draw(docWrapper, options);
    }

    getHeight(docWrapper: PdfDocWrapper): number {
        const grid = this.createGrid(docWrapper);
        return grid.getHeight(docWrapper);
    }

    getWidth(docWrapper: PdfDocWrapper): number | undefined {
        const grid = this.createGrid(docWrapper);
        return grid.getWidth(docWrapper);
    }

    getFonts(): PdfFont[] {
        return [metropolisMedium, metropolisBold];
    }
}

function createMembersDetailHorizontalGridFactory({ members, columns, selectableColumns, getName }: MembersHorizontalGridArgs): (docWrapper: PdfDocWrapper) => HorizontalGrid {
    const enabledColumns = selectableColumns.filter(c => c.enabled);
    const labels = enabledColumns.map(c => c.name);
    const longestLabel = labels.reduce((a, b) => a.length > b.length ? a : b, '');

    return (docWrapper: PdfDocWrapper) => {
        // same label width for each member
        const minLabelWidth = LabelWithValue.widthOfLabel(docWrapper, longestLabel);

        // create a vertical stack for each member
        const memberStacks = members.map(member => memberDetailsVerticalStackFactory(member, enabledColumns, getName(member), minLabelWidth));

        // create a horizontal grid containing the vertical stacks
        const grid = new HorizontalGrid(memberStacks, {
            columns,
            columnGap: mmToPoints(10),
            rowGap: mmToPoints(5),
        });

        return grid;
    };
}

/**
 * A vertical stack of member details of a single member
 * @param member
 * @param columns
 * @param name
 * @param minLabelWidth
 * @returns
 */
function memberDetailsVerticalStackFactory(member: PlatformMember, columns: SelectablePdfData<PlatformMember>[], name: string, minLabelWidth: number): VerticalStack {
    // name of the member
    const title = new H3(name);

    // spacings to reuse
    const spacing4mm = new Spacing(mmToPoints(4));
    const spacing2mm = new Spacing(mmToPoints(2));
    const spacing1mm = new Spacing(mmToPoints(1));

    let currentCategory: string | undefined = undefined;

    // create pdf items for each member detail
    const detailItems = columns.flatMap((c) => {
        const result: PdfItem[] = [];

        // add a category title
        if (c.category) {
            // only if it's a new category
            if (c.category !== currentCategory) {
                result.push(spacing2mm);
                const subTitle = new PdfText(c.category, { font: metropolisBold, fontSize: 9, fillColor: colorDark, align: 'left' });
                result.push(subTitle);
                result.push(spacing2mm);
                currentCategory = c.category;
            }
        }
        else {
            // add spacing below the end of a category
            if (currentCategory !== undefined) {
                result.push(spacing2mm);
            }
            currentCategory = undefined;
        }

        // add a label and a value for the detail
        const labelWithValue = new LabelWithValue({
            label: {
                text: c.name,
                minWidth: minLabelWidth,
            },
            value: {
                text: c.getStringValue(member),
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

    return new VerticalStack([
        title,
        spacing4mm,
        ...detailItems,
    ]);
}
