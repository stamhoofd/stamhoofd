import { colorDark } from '../colors';
import { metropolisBold } from '../fonts';
import type { PdfTextOptions } from './PdfText';
import { PdfText } from './PdfText';

export class H2 extends PdfText {
    constructor(text: string, options: PdfTextOptions = {}) {
        super(text, { font: metropolisBold, fontSize: 16, fillColor: colorDark, align: 'left', ...options });
    }
}
