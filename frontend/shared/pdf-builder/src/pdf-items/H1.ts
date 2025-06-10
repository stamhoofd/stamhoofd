import { colorDark } from '../colors';
import { metropolisBold } from '../fonts';
import { PdfText, PdfTextOptions } from './PdfText';

export class H1 extends PdfText {
    constructor(text: string, options: PdfTextOptions = {}) {
        super(text, { font: metropolisBold, fontSize: 21, fillColor: colorDark, align: 'left', ...options });
    }
}
