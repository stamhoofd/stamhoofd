import logoUrl from '@stamhoofd/assets/images/logo/logo-horizontal.png';
import { PdfDocuments } from '@stamhoofd/frontend-excel-export/src/PdfDocuments';
import { ItemDetailsGrid } from './ItemDetailsGrid';
import { mmToPoints } from './pdf-builder/pdf-helpers';
import { PdfItem } from './pdf-builder/pdf-item';
import { DefaultText } from './pdf-builder/pdf-items/DefaultText';
import { H1 } from './pdf-builder/pdf-items/H1';
import { Logo } from './pdf-builder/pdf-items/logo';
import { PdfRenderer } from './pdf-builder/pdf-renderer';

const pageMargin = mmToPoints(10);

export class MembersPdfDocument<T> {
    // todo: remove dependency on documents
    constructor(private readonly items: T[], private readonly documents: PdfDocuments<T>, private readonly title: string) {
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

        const documentDescription = new DefaultText('Bewaar dit document op een veilige plaats en vernietig het na gebruik.', {
            margin: {
                bottom: mmToPoints(2),
            },
        });
        items.push(documentDescription);

        for (const document of this.documents.documents) {
            if (!document.enabled) {
                continue;
            }
            const grid = new ItemDetailsGrid(document, this.items);
            items.push(grid);
        }

        const renderer = new PdfRenderer();
        return renderer.render(await this.createDoc(), items);
    }

    async download() {
        return (await this.render()).download('Stamhoofd');
    }
}
