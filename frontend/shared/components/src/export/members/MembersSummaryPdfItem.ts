import { colorDark, DefaultText, H3, HorizontalGrid, LabelWithValue, metropolisBold, metropolisMedium, mmToPoints, PdfDocWrapper, PdfFont, PdfItem, PdfItemDrawOptions, PdfItemGetHeightOptions, Spacing, VerticalStack, VerticalStackOptions } from '@stamhoofd/frontend-pdf-builder';
import { PlatformMember } from '@stamhoofd/structures';
import { SelectablePdfData } from '../SelectablePdfData';

interface MembersSummarydArgs {
    members: PlatformMember[];
    selectableColumn: SelectablePdfData<PlatformMember>;
}

/**
 * A vertical stack containing a title, a horizontal grid with a summary of the members (or a text if no members)
 * and spacing.
 */
export class MembersSummaryPdfItem implements PdfItem {
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

function createMembersSummaryStack({ members, selectableColumn }: MembersSummarydArgs): (docWrapper: PdfDocWrapper) => VerticalStack {
    return (docWrapper: PdfDocWrapper) => {
        const title = new H3(selectableColumn.name, {
            spacing: {
                bottom: mmToPoints(4),
            },
        });

        const grid = createMembersHorizontalGridFactory({ members, selectableColumn })(docWrapper);
        const spacing = new Spacing(mmToPoints(5));

        const stackOptions: VerticalStackOptions = {
            minAvailableHeight: mmToPoints(200),
        };

        if (grid === null) {
            return new VerticalStack([
                title,
                new DefaultText($t('Geen leden'), { fillColor: colorDark }),
                spacing,
            ], stackOptions);
        }

        return new VerticalStack([
            title,
            grid,
            spacing,
        ], stackOptions);
    };
}

function createMembersHorizontalGridFactory({ members, selectableColumn }: MembersSummarydArgs): (docWrapper: PdfDocWrapper) => HorizontalGrid | null {
    return (docWrapper: PdfDocWrapper) => {
        // same label width for each member
        const labelsWithValue = members.map((member) => {
            const value = selectableColumn.getStringValueOrNull(member);

            if (value === null) {
                return null;
            }

            // label is member name
            const label = member.patchedMember.details.name;

            return [label, value];
        }).filter(l => l !== null);

        const longestLabel = labelsWithValue.map(([label]) => label).reduce((a, b) => a.length > b.length ? a : b, '');
        const minLabelWidth = LabelWithValue.widthOfLabel(docWrapper, longestLabel);

        // create a single stack
        const stackItems = labelsWithValue.flatMap(([label, value]) => {
            // add a label and a value for the detail
            const labelWithValue = new LabelWithValue({
                label: {
                    text: label,
                    minWidth: minLabelWidth,
                },
                value: {
                    text: value,
                    minWidth: mmToPoints(20),
                    defaultText: ' ',
                    textOptions: {
                        preferredMaxHeight: mmToPoints(60),
                    },
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

        const gridColumnGap = mmToPoints(10);

        const stack = new VerticalStack(stackItems, { isAllowedToSplit: true });

        // create a horizontal grid containing the vertical stacks
        const grid = new HorizontalGrid([stack], {
            columns: 'auto',
            columnGap: gridColumnGap,
            rowGap: mmToPoints(5),
        });

        return grid;
    };
}
