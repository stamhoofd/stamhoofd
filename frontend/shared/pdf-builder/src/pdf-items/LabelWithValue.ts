import { colorDark, colorGray } from '../colors';
import { PdfDocWrapper } from '../PdfDocWrapper';
import { PdfFont } from '../PdfFont';
import { PdfItem, PdfItemDrawOptions, PdfItemGetHeightOptions } from '../PdfItem';
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
        defaultText?: string;
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

    static widthOfLabel(docWrapper: PdfDocWrapper, text: string): number {
        // lineGap is irrelevant for width
        return LabelWithValue.createLabel({ text, minWidth: 0, lineGap: 0 }).getWidth(docWrapper);
    }

    private static createLabel({ text, minWidth, lineGap }: { text: string; minWidth: number; lineGap: number }) {
        return new DefaultText(text, { fillColor: colorGray, width: minWidth, lineGap });
    }

    private static createValueText({ text, lineGap, defaultText }: { text: string; lineGap: number; defaultText?: string }) {
        const isEmpty = text.length === 0;

        if (isEmpty) {
            text = defaultText ? defaultText : '/';
        }

        return new DefaultText(text, { fillColor: isEmpty ? colorGray : colorDark, lineGap });
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

    draw(docWrapper: PdfDocWrapper, options?: PdfItemDrawOptions): void {
        const { x, y } = docWrapper.getNextPosition(options);

        const { labelWidth, valueWidth } = this.getLabelAndValueWidth(options?.maxWidth);

        this.labelText.draw(docWrapper, { ...options, maxWidth: labelWidth, position: { x, y } });
        const labelY = docWrapper.doc.y;

        this.valueText.draw(docWrapper, { ...options, maxWidth: valueWidth, position: { x: x + labelWidth + this.options.gapBetween, y } });
        const valueY = docWrapper.doc.y;

        if (labelY > valueY) {
            docWrapper.doc.y = labelY;
        }
    }

    getHeight(docWrapper: PdfDocWrapper, options?: PdfItemGetHeightOptions): number {
        const { labelWidth, valueWidth } = this.getLabelAndValueWidth(options?.maxWidth);
        return Math.max(
            this.labelText.getHeight(docWrapper, { ...options, maxWidth: labelWidth }),
            this.valueText.getHeight(docWrapper, { ...options, maxWidth: valueWidth }),
        );
    }

    getWidth(_docWrapper: PdfDocWrapper): number | undefined {
        return undefined;
    }

    getFonts(): PdfFont[] {
        return [...this.labelText.getFonts(), ...this.valueText.getFonts()];
    }
}
