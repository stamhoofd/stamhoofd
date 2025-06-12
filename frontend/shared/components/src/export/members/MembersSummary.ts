import { colorDark, DefaultText, H3, HorizontalGrid, LabelWithValue, metropolisBold, metropolisMedium, mmToPoints, PdfDocWrapper, PdfFont, PdfItem, PdfItemDrawOptions, PdfItemGetHeightOptions, Spacing, VerticalStack } from '@stamhoofd/frontend-pdf-builder';
import { PlatformMember } from '@stamhoofd/structures';
import { SelectablePdfData } from '../SelectablePdfData';

interface MembersSummarydArgs {
    members: PlatformMember[];
    columns: number;
    selectableColumn: SelectablePdfData<PlatformMember>;
    getName: (member: PlatformMember) => string;
}

/**
 * A horizontal grid with a summary of the members
 */
export class MembersSummary implements PdfItem {
    private readonly factory: (docWrapper: PdfDocWrapper) => VerticalStack;

    constructor(private readonly args: MembersSummarydArgs) {
        this.factory = createMembersSummaryStack(this.args);
    }

    private create(docWrapper: PdfDocWrapper) {
        return this.factory(docWrapper);
    }

    draw(docWrapper: PdfDocWrapper, options: PdfItemDrawOptions): void {
        const stack = this.create(docWrapper);
        stack.draw(docWrapper, options);
    }

    getHeight(docWrapper: PdfDocWrapper, options: PdfItemGetHeightOptions): number {
        return this.create(docWrapper).getHeight(docWrapper, options);
    }

    getWidth(docWrapper: PdfDocWrapper): number | undefined {
        return this.create(docWrapper).getWidth(docWrapper);
    }

    getFonts(): PdfFont[] {
        return [metropolisMedium, metropolisBold];
    }
}

function createMembersSummaryStack({ members, columns, selectableColumn, getName }: MembersSummarydArgs): (docWrapper: PdfDocWrapper) => VerticalStack {
    return (docWrapper: PdfDocWrapper) => {
        const title = new H3(selectableColumn.name, {
            spacing: {
                bottom: mmToPoints(4),
            },
        });

        const grid = createMembersHorizontalGridFactory({ members, columns, selectableColumn, getName })(docWrapper);
        if (grid === null) {
            return new VerticalStack([
                title,
                new DefaultText($t('Geen leden'), { fillColor: colorDark }),
                new Spacing(mmToPoints(5)),
            ]);
        }

        return new VerticalStack([
            title,
            grid,
            new Spacing(mmToPoints(5)),
        ]);
    };
}

function createMembersHorizontalGridFactory({ members, columns, selectableColumn, getName }: MembersSummarydArgs): (docWrapper: PdfDocWrapper) => HorizontalGrid | null {
    const labels = members.map(m => getName(m));
    const longestLabel = labels.reduce((a, b) => a.length > b.length ? a : b, '');

    return (docWrapper: PdfDocWrapper) => {
        // same label width for each member
        const minLabelWidth = LabelWithValue.widthOfLabel(docWrapper, longestLabel);

        // create a single stack
        const stackItems = members.flatMap((member) => {
            const value = selectableColumn.getStringValueOrNull(member);

            if (value === null) {
                return [];
            }

            // add a label and a value for the detail
            const labelWithValue = new LabelWithValue({
                label: {
                    text: getName(member),
                    minWidth: minLabelWidth,
                },
                value: {
                    text: value,
                    defaultText: ' ',
                },
                gapBetween: mmToPoints(2),
                // lineGap of 1mm (for small spacing between lines of the value and label text)
                lineGap: mmToPoints(1),
            });

            return [labelWithValue];
        });

        if (stackItems.length === 0) {
            return null;
        }

        const stack = new VerticalStack(stackItems);

        // create a horizontal grid containing the vertical stacks
        const grid = new HorizontalGrid([stack], {
            columns,
            columnGap: mmToPoints(10),
            rowGap: mmToPoints(5),
        });

        return grid;
    };
}
