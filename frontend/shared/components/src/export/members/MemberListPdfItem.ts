import type { PdfDocWrapper } from '@stamhoofd/frontend-pdf-builder/PdfDocWrapper';
import type { PdfFont } from '@stamhoofd/frontend-pdf-builder/PdfFont';
import type { PdfItem, PdfItemDrawOptions, PdfItemGetHeightOptions } from '@stamhoofd/frontend-pdf-builder/PdfItem';
import { colorDark } from '@stamhoofd/frontend-pdf-builder/colors';
import { metropolisBold, metropolisMedium } from '@stamhoofd/frontend-pdf-builder/fonts';
import { mmToPoints } from '@stamhoofd/frontend-pdf-builder/pdf-helpers';
import { H3 } from '@stamhoofd/frontend-pdf-builder/pdf-items/H3';
import { HorizontalGrid } from '@stamhoofd/frontend-pdf-builder/pdf-items/HorizontalGrid';
import { LabelWithValue } from '@stamhoofd/frontend-pdf-builder/pdf-items/LabelWithValue';
import { PdfText } from '@stamhoofd/frontend-pdf-builder/pdf-items/PdfText';
import { Spacing } from '@stamhoofd/frontend-pdf-builder/pdf-items/Spacing';
import { VerticalStack } from '@stamhoofd/frontend-pdf-builder/pdf-items/VerticalStack';
import type { PlatformMember } from '@stamhoofd/structures';
import type { SelectablePdfData } from '../SelectablePdfData';

interface MembersDetailArgs {
    members: PlatformMember[];
    columns: number | 'auto';
    selectableColumns: SelectablePdfData<PlatformMember>[];
    shouldHideEmptyDetails: boolean;
}

/**
 * A horizontal grid of member details
 */
export class MemberListPdfItem implements PdfItem {
    private readonly factory: (docWrapper: PdfDocWrapper) => HorizontalGrid;

    constructor(private readonly args: MembersDetailArgs) {
        this.factory = createMembersDetailHorizontalGridFactory(this.args);
    }

    private createGrid(docWrapper: PdfDocWrapper) {
        return this.factory(docWrapper);
    }

    draw(docWrapper: PdfDocWrapper, options?: PdfItemDrawOptions): void {
        const grid = this.createGrid(docWrapper);
        grid.draw(docWrapper, options);
    }

    getHeight(docWrapper: PdfDocWrapper, options: PdfItemGetHeightOptions): number {
        const grid = this.createGrid(docWrapper);
        return grid.getHeight(docWrapper, options);
    }

    getWidth(docWrapper: PdfDocWrapper): number | undefined {
        const grid = this.createGrid(docWrapper);
        return grid.getWidth(docWrapper);
    }

    getFonts(): PdfFont[] {
        return [metropolisMedium, metropolisBold];
    }
}

function createMembersDetailHorizontalGridFactory({ members, columns, selectableColumns, shouldHideEmptyDetails }: MembersDetailArgs): (docWrapper: PdfDocWrapper) => HorizontalGrid {
    const enabledColumns = selectableColumns.filter(c => c.enabled);
    const labels = enabledColumns.map(c => c.name);
    const longestLabel = labels.reduce((a, b) => a.length > b.length ? a : b, '');

    return (docWrapper: PdfDocWrapper) => {
        // same label width for each member
        const minLabelWidth = LabelWithValue.widthOfLabel(docWrapper, longestLabel);

        // create a vertical stack for each member
        const memberStacks = members.map((member) => {
            const memberName = member.patchedMember.details.name;
            return memberDetailsVerticalStackFactory(member, enabledColumns, memberName, minLabelWidth, shouldHideEmptyDetails);
        });

        // create a horizontal grid containing the vertical stacks
        const grid = new HorizontalGrid(memberStacks, {
            columns,
            columnGap: mmToPoints(4),
            rowGap: mmToPoints(4),
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
function memberDetailsVerticalStackFactory(member: PlatformMember, columns: SelectablePdfData<PlatformMember>[], name: string, minLabelWidth: number, shouldHideEmptyDetails: boolean): VerticalStack {
    // name of the member
    const title = new H3(name, {
        preferredMaxHeight: mmToPoints(100),
    });

    // spacings to reuse
    const spacing4mm = new Spacing(mmToPoints(4));
    const spacing2mm = new Spacing(mmToPoints(2));
    const spacing1mm = new Spacing(mmToPoints(1));

    let currentCategory: string | undefined = undefined;

    // create pdf items for each member detail
    const detailItems = columns.flatMap((c) => {
        let stringValue: string;

        if (shouldHideEmptyDetails) {
            const stringValueOrNull = c.getStringValueOrNull(member);

            if (!stringValueOrNull) {
                return [];
            }

            stringValue = stringValueOrNull;
        }
        else {
            stringValue = c.getStringValue(member);
        }

        const result: PdfItem[] = [];

        // add a category title
        if (c.category) {
            // only if it's a new category
            if (c.category !== currentCategory) {
                result.push(spacing2mm);
                const subTitle = new PdfText(c.category, { font: metropolisBold, fontSize: 9, fillColor: colorDark, align: 'left', underline: true, preferredMaxHeight: mmToPoints(100) });
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
                text: stringValue,
                minWidth: mmToPoints(20),
                textOptions: {
                    preferredMaxHeight: mmToPoints(100),
                },
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
