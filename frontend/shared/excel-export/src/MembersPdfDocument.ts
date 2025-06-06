import logoUrl from '@stamhoofd/assets/images/logo/logo-horizontal.png';
import { PlatformMember } from '@stamhoofd/structures';
import { MembersHorizontalGrid } from './MembersHorizontalGrid';
import { mmToPoints } from './pdf-builder/pdf-helpers';
import { PdfItem } from './pdf-builder/pdf-item';
import { DefaultText } from './pdf-builder/pdf-items/DefaultText';
import { H1 } from './pdf-builder/pdf-items/H1';
import { Logo } from './pdf-builder/pdf-items/Logo';
import { PdfRenderer } from './pdf-builder/pdf-renderer';
import { SelectablePdfColumn } from './SelectablePdfColumn';

const pageMargin = mmToPoints(10);

export class MembersPdfDocument {
    // todo: remove dependency on documents
    constructor(private readonly items: PlatformMember[], private readonly memberDetailsSelectableColumns: SelectablePdfColumn<PlatformMember>[], private readonly title: string) {
    }

    private async createDoc(): Promise<PDFKit.PDFDocument> {
        const PDFDocument = (await import('pdfkit/js/pdfkit.standalone')).default as PDFKit.PDFDocument;
        return new PDFDocument({ size: 'A4', margin: pageMargin, bufferPages: true });
    }

    private async render() {
        const items: PdfItem[] = [];

        const logo = new Logo({ src: await (await fetch(logoUrl as string)).arrayBuffer(), width: mmToPoints(30) });
        items.push(logo);

        const documentTitle = new H1(this.title, {
            position: {
                x: pageMargin,
                y: pageMargin,
            },
            margin: {
                bottom: mmToPoints(2),
            },
        });
        items.push(documentTitle);

        const documentDescription = new DefaultText($t('Bewaar dit document op een veilige plaats en vernietig het na gebruik.'), {
            margin: {
                bottom: mmToPoints(4),
            },
        });
        items.push(documentDescription);

        const grid = new MembersHorizontalGrid({
            objects: this.items.sort(PlatformMember.sorterByName('ASC')),
            columns: 2,
            selectableColumns: this.memberDetailsSelectableColumns,
            getName: (o: PlatformMember) => o.patchedMember.details.name,
        });
        items.push(grid);

        const renderer = new PdfRenderer();
        const doc = await this.createDoc();
        return renderer.render(doc, items);
    }

    async download() {
        return (await this.render()).download('Stamhoofd');
    }
}
