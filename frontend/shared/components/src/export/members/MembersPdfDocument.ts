import logoUrl from '@stamhoofd/assets/images/logo/logo-horizontal.png';
import { colorGray, DefaultText, drawPageNumbers, H1, Logo, metropolisMedium, mmToPoints, PdfDocWrapper, PdfItem, PdfRenderer, PdfTextOptions } from '@stamhoofd/frontend-pdf-builder';
import { PlatformMember } from '@stamhoofd/structures';
import { SelectablePdfSheet } from '../SelectablePdfSheet';
import { MemberListPdfItem } from './MemberListPdfItem';
import { MembersSummaryPdfItem } from './MembersSummaryPdfItem';

const pageMargin = mmToPoints(15);

export class MembersPdfDocument {
    constructor(private readonly items: PlatformMember[], private readonly memberDetailsDocument: SelectablePdfSheet<PlatformMember>, private readonly membersSummaryDocument: SelectablePdfSheet<PlatformMember>, private readonly title: string) {
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
                bottom: mmToPoints(8),
            },
        });
        items.push(documentDescription);

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
