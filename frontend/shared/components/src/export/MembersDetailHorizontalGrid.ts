import { colorDark, H3, HorizontalGrid, LabelWithValue, metropolisBold, metropolisMedium, mmToPoints, PdfDocWrapper, PdfFont, PdfItem, PdfItemDrawOptions, PdfText, Spacing, VerticalStack } from '@stamhoofd/frontend-pdf-builder';
import { PlatformMember } from '@stamhoofd/structures';
import { SelectablePdfData } from './SelectablePdfData';

interface MembersHorizontalGridArgs {
    members: PlatformMember[];
    columns: number;
    selectableColumns: SelectablePdfData<PlatformMember>[];
    getName: (member: PlatformMember) => string;
}

/**
 * A horizontal grid of member details
 */
export class MembersDetailHorizontalGrid implements PdfItem {
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
