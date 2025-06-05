import { PdfFont } from '../pdf-font';
import { PdfItem } from '../pdf-item';

export type PdfTextOptions = {
    font?: PdfFont;
    fontSize?: number;
    fillColor?: string;
    position?: {
        x: number;
        y: number;
    };
    margin?: {
        bottom?: number;
    };
} & PDFKit.Mixins.TextOptions;

export class PdfText implements PdfItem {
    private get marginBottom() {
        return this.options.margin?.bottom ?? 0;
    }

    constructor(private readonly text: string, private readonly options: PdfTextOptions = {}) {
    }

    private configure(doc: PDFKit.PDFDocument) {
        if (this.options.font !== undefined) {
            doc.font(this.options.font.name);
        }

        if (this.options.fontSize !== undefined) {
            doc.fontSize(this.options.fontSize);
        }

        if (this.options.fillColor !== undefined) {
            doc.fillColor(this.options.fillColor);
        }
    }

    getHeight(doc: PDFKit.PDFDocument): number {
        this.configure(doc);
        return doc.heightOfString(this.text, this.options) + this.marginBottom;
    }

    getWidth(doc: PDFKit.PDFDocument) {
        this.configure(doc);
        return doc.widthOfString(this.text, this.options);
    }

    getFonts() {
        if (this.options.font) {
            return [this.options.font];
        }

        return [];
    }

    draw(doc: PDFKit.PDFDocument, { x, y }: { x?: number; y?: number } = {}) {
        this.configure(doc);

        if (this.options.position) {
            x = this.options.position.x;
            y = this.options.position.y;
        }

        doc.text(this.text, x, y, this.options);
        if (this.marginBottom > 0) {
            doc.y = doc.y + this.marginBottom;
        }
    }
}
