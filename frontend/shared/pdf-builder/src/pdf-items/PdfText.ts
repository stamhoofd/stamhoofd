import { PdfDocWrapper } from '../pdf-doc-wrapper';
import { PdfFont } from '../pdf-font';
import { PdfItem, PdfItemDrawOptions, PdfItemGetHeightOptions } from '../pdf-item';

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
    spacing?: {
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
        return this.options.spacing?.bottom ?? 0;
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

    private getTextOptions(maxWidth: number | undefined) {
        const textOptions = { ...this.options };
        if (maxWidth !== undefined && (textOptions.width === undefined || maxWidth < textOptions.width)) {
            textOptions.width = maxWidth;
        }
        return textOptions;
    }

    getHeight(docWrapper: PdfDocWrapper, options: PdfItemGetHeightOptions = {}): number {
        const doc = docWrapper.doc;
        this.configure(doc);

        const textOptions = this.getTextOptions(options.maxWidth);

        return doc.heightOfString(this.text, textOptions) + this.marginBottom;
    }

    getWidth(docWrapper: PdfDocWrapper) {
        const doc = docWrapper.doc;
        this.configure(doc);
        return doc.widthOfString(this.text, this.options);
    }

    getFonts() {
        if (this.options.font) {
            return [this.options.font];
        }

        return [];
    }

    draw(docWrapper: PdfDocWrapper, options: PdfItemDrawOptions) {
        const doc = docWrapper.doc;
        this.configure(doc);

        let { x, y } = docWrapper.getNextPosition(options);

        if (this.options.position) {
            x = this.options.position.x;
            y = this.options.position.y;
        }

        const textOptions = this.getTextOptions(options.maxWidth);

        doc.text(this.text, x, y, textOptions);
        if (this.marginBottom > 0) {
            doc.y = doc.y + this.marginBottom;
        }
    }
}
