import { colorDark, DefaultText, HorizontalGrid, LabelWithValue, metropolisBold, metropolisMedium, mmToPoints, PdfDocWrapper, PdfFont, PdfItem, PdfItemDrawOptions, VerticalStack } from '@stamhoofd/frontend-pdf-builder';
import { PlatformMember } from '@stamhoofd/structures';
import { SelectablePdfData } from './SelectablePdfData';

interface MembersSummaryHorizontalGridArgs {
    members: PlatformMember[];
    columns: number;
    selectableColumn: SelectablePdfData<PlatformMember>;
    getName: (member: PlatformMember) => string;
}

/**
 * A horizontal grid with a summary of the members
 */
export class MembersSummaryHorizontalGrid implements PdfItem {
    private readonly factory: (docWrapper: PdfDocWrapper) => HorizontalGrid | null;

    constructor(private readonly args: MembersSummaryHorizontalGridArgs) {
        this.factory = createMembersHorizontalGridFactory(this.args);
    }

    private createGrid(docWrapper: PdfDocWrapper) {
        return this.factory(docWrapper);
    }

    private createEmptyText() {
        return new DefaultText($t('Geen leden'), { fillColor: colorDark });
    }

    draw(docWrapper: PdfDocWrapper, options: PdfItemDrawOptions): void {
        const grid = this.createGrid(docWrapper);

        if (grid) {
            grid.draw(docWrapper, options);
        }
        else {
            this.createEmptyText().draw(docWrapper, options);
        }
    }

    getHeight(docWrapper: PdfDocWrapper): number {
        const grid = this.createGrid(docWrapper);

        if (grid) {
            return grid.getHeight(docWrapper);
        }

        return this.createEmptyText().getHeight(docWrapper);
    }

    getWidth(docWrapper: PdfDocWrapper): number | undefined {
        const grid = this.createGrid(docWrapper);

        if (grid) {
            return grid.getWidth(docWrapper);
        }

        return this.createEmptyText().getWidth(docWrapper);
    }

    getFonts(): PdfFont[] {
        return [metropolisMedium, metropolisBold];
    }
}

function createMembersHorizontalGridFactory({ members, columns, selectableColumn, getName }: MembersSummaryHorizontalGridArgs): (docWrapper: PdfDocWrapper) => HorizontalGrid | null {
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
