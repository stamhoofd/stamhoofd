import { colorDark } from '../colors';
import { metropolisBold } from '../fonts';
import { PdfText, PdfTextOptions } from './PdfText';

export class H3 extends PdfText {
    constructor(text: string, options: PdfTextOptions = {}) {
        super(text, { font: metropolisBold, fontSize: 11, fillColor: colorDark, align: 'left', ...options });
    }
}
