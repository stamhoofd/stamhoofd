import { colorGray } from '../colors';
import { metropolisMedium } from '../fonts';
import { PdfText, PdfTextOptions } from './PdfText';

export class DefaultText extends PdfText {
    constructor(text: string, options: PdfTextOptions = {}) {
        super(text, { font: metropolisMedium, fontSize: 9, fillColor: colorGray, align: 'left', ...options });
    }
}
