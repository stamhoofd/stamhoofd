import { colorDark, colorGray } from '../colors';
import { PdfDocWrapper } from '../PdfDocWrapper';
import { PdfFont } from '../PdfFont';
import { PdfItem, PdfItemDrawOptions, PdfItemGetHeightOptions } from '../PdfItem';
import { DefaultText } from './DefaultText';
import { PdfTextOptions } from './PdfText';

export interface LabelWithValueOptions {
    label: {
        text: string;
        /**
         * min width of the label,
         * if more space is available the label will expand
         */
        minWidth: number;
        textOptions?: PdfTextOptions;
    };
    value: {
        text: string;
        defaultText?: string;
        textOptions?: PdfTextOptions;
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
    private static defaultLabelTextOptions: PdfTextOptions = { fillColor: colorDark };

    constructor(private readonly options: LabelWithValueOptions) {
        this.labelText = LabelWithValue.createLabel({ ...options.label, lineGap: options.lineGap, textOptions: options.label.textOptions ?? {} });
        this.valueText = LabelWithValue.createValueText({ ...options.value, lineGap: options.lineGap, textOptions: options.value.textOptions ?? {} });
    }

    static widthOfLabel(docWrapper: PdfDocWrapper, text: string, textOptions: PdfTextOptions = this.defaultLabelTextOptions): number {
        // lineGap is irrelevant for width
        return LabelWithValue.createLabel({ text, minWidth: 0, lineGap: 0, textOptions }).getWidth(docWrapper);
    }

    private static createLabel({ text, minWidth, lineGap, textOptions }: { text: string; minWidth: number; lineGap: number; textOptions: PdfTextOptions }) {
        return new DefaultText(text, { ...this.defaultLabelTextOptions, width: minWidth, lineGap, ...textOptions });
    }

    private static createValueText({ text, lineGap, defaultText, textOptions }: { text: string; lineGap: number; defaultText?: string; textOptions: PdfTextOptions }) {
        const isEmpty = text.length === 0;

        if (isEmpty) {
            text = defaultText ? defaultText : '/';
        }

        return new DefaultText(text, { fillColor: isEmpty ? colorGray : colorGray, lineGap, ...textOptions });
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

    getWidth(docWrapper: PdfDocWrapper): number {
        return this.labelText.getWidth(docWrapper) + this.valueText.getWidth(docWrapper) + this.options.gapBetween;
    }

    getFonts(): PdfFont[] {
        return [...this.labelText.getFonts(), ...this.valueText.getFonts()];
    }
}
