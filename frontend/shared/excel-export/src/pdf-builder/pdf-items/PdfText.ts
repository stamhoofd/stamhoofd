import { PdfFont } from '../pdf-font';
import { PdfItem, PdfItemDrawOptions } from '../pdf-item';

export type PdfTextOptions = {
    font?: PdfFont;
    fontSize?: number;
    fillColor?: string;
    /**
     * The position of the text,
     * leave undefined to use the current position.
     */
    position?: {
        x: number;
        y: number;
    };
    margin?: {
        /**
         * spacing below the text
         */
        bottom?: number;
    };
} & PDFKit.Mixins.TextOptions;

/**
 * A text
 */
export class PdfText implements PdfItem {
    private get marginBottom() {
        return this.options.margin?.bottom ?? 0;
    }

    constructor(private readonly text: string, private readonly options: PdfTextOptions = {}) {
    }

    private configure(doc: PDFKit.PDFDocument) {
        if (this.options.font !== undefined) {
            console.log('this.options.font.name', this.options.font.name);
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

    draw(doc: PDFKit.PDFDocument, options?: PdfItemDrawOptions) {
        this.configure(doc);

        let x = options?.position?.x === undefined ? doc.x : options.position.x;
        let y = options?.position?.y === undefined ? doc.y : options.position.y;

        if (this.options.position) {
            x = this.options.position.x;
            y = this.options.position.y;
        }

        const textOptions = { ...this.options };
        if (options?.maxWidth) {
            textOptions.width = options.maxWidth;
        }

        doc.text(this.text, x, y, textOptions);
        if (this.marginBottom > 0) {
            doc.y = doc.y + this.marginBottom;
        }
    }
}
