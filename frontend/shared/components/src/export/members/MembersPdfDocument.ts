import { colorGray, DefaultText, drawPageNumbers, H1, metropolisMedium, mmToPoints, PdfDocWrapper, PdfItem, PdfRenderer, PdfTextOptions } from '@stamhoofd/frontend-pdf-builder';
import { Image, PlatformMember } from '@stamhoofd/structures';
import { imageToDocumentLogo } from '../imageToDocumentLogo';
import { SelectablePdfSheet } from '../SelectablePdfSheet';
import { MemberListPdfItem } from './MemberListPdfItem';
import { MembersSummaryPdfItem } from './MembersSummaryPdfItem';

const pageMargin = mmToPoints(15);

export class MembersPdfDocument {
    constructor(private readonly items: PlatformMember[], private readonly memberDetailsDocument: SelectablePdfSheet<PlatformMember>, private readonly membersSummaryDocument: SelectablePdfSheet<PlatformMember>, private readonly title: string, private readonly logoImage: Image | null) {
    }

    private async createDoc(): Promise<PDFKit.PDFDocument> {
        const PDFDocument = (await import('pdfkit/js/pdfkit.standalone')).default as PDFKit.PDFDocument;
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
            new DefaultText($t('5b0672f0-f376-4306-9161-b2b840b723c2'), {
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
