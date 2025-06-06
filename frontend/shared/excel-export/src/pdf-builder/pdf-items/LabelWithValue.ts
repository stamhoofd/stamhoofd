import { colorDark, colorGray } from '../colors';
import { PdfFont } from '../pdf-font';
import { PdfItem, PdfItemDrawOptions, PdfItemGetHeightOptions } from '../pdf-item';
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
    lineGap: number;
}

/**
 * A row with a label, a gap between and a value.
 */
export class LabelWithValue implements PdfItem {
    private readonly labelText: DefaultText;
    private readonly valueText: DefaultText;

    constructor(private readonly options: LabelWithValueOptions) {
        this.labelText = LabelWithValue.createLabel({ ...options.label, lineGap: options.lineGap });
        this.valueText = LabelWithValue.createValueText({ ...options.value, lineGap: options.lineGap });
    }

    static widthOfLabel(doc: PDFKit.PDFDocument, text: string): number {
        // lineGap is irrelevant for width
        return LabelWithValue.createLabel({ text, minWidth: 0, lineGap: 0 }).getWidth(doc);
    }

    private static createLabel({ text, minWidth, lineGap }: { text: string; minWidth: number; lineGap: number }) {
        return new DefaultText(text, { fillColor: colorGray, width: minWidth, lineGap });
    }

    private static createValueText({ text, lineGap }: { text: string; lineGap: number }) {
        const isEmpty = text.length === 0;
        return new DefaultText(isEmpty ? '/' : text, { fillColor: isEmpty ? colorGray : colorDark, lineGap });
    }

    private getLabelAndValueWidth(maxWidth: number | undefined) {
        let labelWidth = this.options.label.minWidth;
        let valueWidth: number | undefined = undefined;

        if (maxWidth !== undefined) {
            labelWidth = Math.max(labelWidth, (maxWidth - this.options.gapBetween) / 2);
            valueWidth = maxWidth - labelWidth - this.options.gapBetween;
        }

        return {
            labelWidth,
            valueWidth,
        };
    }

    draw(doc: PDFKit.PDFDocument, options?: PdfItemDrawOptions): void {
        const x = options?.position?.x === undefined ? doc.x : options.position.x;
        const y = options?.position?.y === undefined ? doc.y : options.position.y;

        const { labelWidth, valueWidth } = this.getLabelAndValueWidth(options?.maxWidth);

        this.labelText.draw(doc, { ...options, maxWidth: labelWidth, position: { x, y } });
        this.valueText.draw(doc, { ...options, maxWidth: valueWidth, position: { x: x + labelWidth + this.options.gapBetween, y } });
    }

    getHeight(doc: PDFKit.PDFDocument, options?: PdfItemGetHeightOptions): number {
        const { labelWidth, valueWidth } = this.getLabelAndValueWidth(options?.maxWidth);
        return Math.max(
            this.labelText.getHeight(doc, { ...options, maxWidth: labelWidth }),
            this.valueText.getHeight(doc, { ...options, maxWidth: valueWidth }),
        );
    }

    getWidth(_doc: PDFKit.PDFDocument): number | undefined {
        return undefined;
    }

    getFonts(): PdfFont[] {
        return [...this.labelText.getFonts(), ...this.valueText.getFonts()];
    }
}
