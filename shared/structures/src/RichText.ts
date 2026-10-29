import { AutoEncoder, field, StringDecoder } from '@common/encoding';
import { Formatter } from '@stamhoofd/utility';

export class RichText extends AutoEncoder {
    @field({ decoder: StringDecoder })
    html = '';

    @field({ decoder: StringDecoder })
    text = '';

    /**
     * Converts a plain text into a rich text: every line becomes a paragraph
     */
    static fromText(text: string): RichText {
        const html = text.split('\n').map(line => `<p>${Formatter.escapeHtml(line)}</p>`).join('');
        return RichText.create({ text, html });
    }

    toString() {
        return this.text;
    }

    getDiffValue() {
        return this.text;
    }
}
