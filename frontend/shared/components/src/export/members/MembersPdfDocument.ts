import logoUrl from '@stamhoofd/assets/images/logo/logo-horizontal.png';
import { colorGray, DefaultText, drawPageNumbers, H1, Logo, metropolisMedium, mmToPoints, PdfDocWrapper, PdfItem, PdfRenderer, PdfTextOptions } from '@stamhoofd/frontend-pdf-builder';
import { PlatformMember } from '@stamhoofd/structures';
import { PdfDocument } from '../PdfDocuments';
import { MembersDetail } from './MembersDetail';
import { MembersSummary } from './MembersSummary';

const pageMargin = mmToPoints(15);

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
            const grid = new MembersDetail({
                members: sortedMembers,
                columns: 2,
                selectableColumns: this.memberDetailsDocument.items,
                getName: (o: PlatformMember) => o.patchedMember.details.name,
                shouldHideEmptyDetails: true,
            });
            items.push(grid);
        }

        // member summary
        if (this.membersSummaryDocument.enabled) {
            items.push(...this.membersSummaryDocument.items
                .filter(c => c.enabled)
                .map(selectableColumn => new MembersSummary({
                    members: sortedMembers,
                    columns: 2,
                    selectableColumn,
                    getName: (o: PlatformMember) => o.patchedMember.details.name,
                })));
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
