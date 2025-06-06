import { colorDark, colorGray } from '../colors';
import { PdfFont } from '../pdf-font';
import { PdfItem, PdfItemDrawOptions } from '../pdf-item';
import { DefaultText } from './DefaultText';

export interface LabelWithValueOptions {
    label: {
        text: string;
        /**
         * min width of the label,
         * if more space is available the label will expand
         */
        minWidth: number;
    };
    value: {
        text: string;
    };
    /**
     * horizontal gap between the label and the value
     */
    gapBetween: number;
}

/**
 * A row with a label, a gap between and a value.
 */
export class LabelWithValue implements PdfItem {
    private readonly labelText: DefaultText;
    private readonly valueText: DefaultText;

    constructor(private readonly options: LabelWithValueOptions) {
        this.labelText = LabelWithValue.createLabel(options.label);
        this.valueText = LabelWithValue.createValueText(options.value);
    }

    static widthOfLabel(doc: PDFKit.PDFDocument, text: string): number {
        return LabelWithValue.createLabel({ text, minWidth: 0 }).getWidth(doc);
    }

    private static createLabel({ text, minWidth }: { text: string; minWidth: number }) {
        return new DefaultText(text, { fillColor: colorGray, width: minWidth });
    }

    private static createValueText({ text }: { text: string }) {
        const isEmpty = text.length === 0;
        return new DefaultText(isEmpty ? '/' : text, { fillColor: isEmpty ? colorGray : colorDark });
    }

    draw(doc: PDFKit.PDFDocument, options?: PdfItemDrawOptions): void {
        const x = options?.position?.x === undefined ? doc.x : options.position.x;
        const y = options?.position?.y === undefined ? doc.y : options.position.y;

        let labelWidth = this.options.label.minWidth;
        let valueWidth: number | undefined = undefined;

        if (options?.maxWidth !== undefined) {
            labelWidth = Math.max(labelWidth, options.maxWidth - this.options.gapBetween / 2);
            valueWidth = options.maxWidth - labelWidth - this.options.gapBetween;
        }

        this.labelText.draw(doc, { ...options, maxWidth: labelWidth, position: { x, y } });
        this.valueText.draw(doc, { ...options, maxWidth: valueWidth, position: { x: x + labelWidth + this.options.gapBetween, y } });
    }

    getHeight(doc: PDFKit.PDFDocument): number {
        return Math.max(this.labelText.getHeight(doc), this.valueText.getHeight(doc));
    }

    getWidth(_doc: PDFKit.PDFDocument): number | undefined {
        return undefined;
    }

    getFonts(): PdfFont[] {
        return [...this.labelText.getFonts(), ...this.valueText.getFonts()];
    }
}
