import type { PdfTextOptions } from '@stamhoofd/frontend-pdf-builder/pdf-items/PdfText';
import type { PdfItem } from '@stamhoofd/frontend-pdf-builder/PdfItem';
import { colorGray } from '@stamhoofd/frontend-pdf-builder/colors';
import { drawPageNumbers } from '@stamhoofd/frontend-pdf-builder/drawPageNumbers';
import { metropolisMedium } from '@stamhoofd/frontend-pdf-builder/fonts';
import { mmToPoints } from '@stamhoofd/frontend-pdf-builder/pdf-helpers';
import { DefaultText } from '@stamhoofd/frontend-pdf-builder/pdf-items/DefaultText';
import { H1 } from '@stamhoofd/frontend-pdf-builder/pdf-items/H1';
import { Spacing } from '@stamhoofd/frontend-pdf-builder/pdf-items/Spacing';
import { PdfDocWrapper } from '@stamhoofd/frontend-pdf-builder/PdfDocWrapper';
import { PdfRenderer } from '@stamhoofd/frontend-pdf-builder/PdfRenderer';
import type { Image } from '@stamhoofd/structures';
import { PlatformMember } from '@stamhoofd/structures';
import { imageToDocumentLogo } from '../imageToDocumentLogo';
import type { SelectablePdfSheet } from '../SelectablePdfSheet';
import { MemberListPdfItem } from './MemberListPdfItem';
import { MembersSummaryPdfItem } from './MembersSummaryPdfItem';

const pageMargin = mmToPoints(15);

export class MembersPdfDocument {
    constructor(private readonly items: PlatformMember[], private readonly memberDetailsDocument: SelectablePdfSheet<PlatformMember>, private readonly membersSummaryDocument: SelectablePdfSheet<PlatformMember>, private readonly title: string, private readonly logoImage: Image | null) {
    }

    private async createDoc(): Promise<PDFKit.PDFDocument> {
        const PDFDocument = (await import('pdfkit/js/pdfkit.standalone')).default;
        return new PDFDocument({ size: 'A4', margin: pageMargin, bufferPages: true });
    }

    private async render() {
        const items: PdfItem[] = [
            // logo
            await imageToDocumentLogo(this.logoImage),
            // title
            new H1(this.title, {
                position: {
                    x: pageMargin,
                    y: pageMargin,
                },
                spacing: {
                    bottom: mmToPoints(2),
                },
            }),
            // description
            new DefaultText($t('%17Q'), {
                spacing: {
                    bottom: mmToPoints(8),
                },
            }),
        ];

        const sortedMembers = [...this.items].sort(PlatformMember.sorterByName('ASC'));

        // member details
        if (this.memberDetailsDocument.enabled) {
            const grid = new MemberListPdfItem({
                members: sortedMembers,
                columns: 'auto',
                selectableColumns: this.memberDetailsDocument.items,
                shouldHideEmptyDetails: true,
            });
            items.push(grid);
        }

        if (this.memberDetailsDocument.enabled && this.membersSummaryDocument.enabled) {
            items.push(new Spacing(mmToPoints(5)));
        }

        // member summary
        if (this.membersSummaryDocument.enabled) {
            const summaryItems = this.membersSummaryDocument.items
                .filter(c => c.enabled)
                .map(selectableColumn => new MembersSummaryPdfItem({
                    members: sortedMembers,
                    selectableColumn,
                }));

            items.push(...summaryItems);
        }

        // render
        const renderer = new PdfRenderer();
        const doc = await this.createDoc();
        const docWrapper = new PdfDocWrapper(doc, mmToPoints(5));

        return renderer.render(docWrapper, items, (docWrapper) => {
            const textOptions: PdfTextOptions = {
                font: metropolisMedium,
                fontSize: 9,
                fillColor: colorGray,
                align: 'right',
                baseline: 'bottom',
            };

            drawPageNumbers(docWrapper, this.title, textOptions);
        });
    }

    async download() {
        return (await this.render()).download('Stamhoofd');
    }
}
