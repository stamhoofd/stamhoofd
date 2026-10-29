import { AnyDecoder, AutoEncoder, field, StringDecoder } from '@common/encoding';
import { Formatter } from '@stamhoofd/utility';

/**
 * json is the source; html and text are derived from it, the same way as in EmailContent. It is the
 * format that is translated automatically, because a translation only touches the text of a text node
 * and leaves the structure, node types, attrs and marks identical, so the answer can be checked.
 */
export class RichText extends AutoEncoder {
    @field({ decoder: StringDecoder })
    html = '';

    @field({ decoder: StringDecoder })
    text = '';

    /**
     * Empty for content stored before this field existed: the editor falls back to the html and fills
     * this on the next save, so nothing has to be migrated.
     */
    @field({ decoder: AnyDecoder, ...NextVersion })
    json: any = {};

    /**
     * Every line becomes a paragraph
     */
    static fromText(text: string): RichText {
        const lines = text.split('\n');
        const html = lines.map(line => `<p>${Formatter.escapeHtml(line)}</p>`).join('');
        const json = {
            type: 'doc',
            // A paragraph without text is an empty paragraph: TipTap does not accept an empty text node
            content: lines.map(line => line.length === 0
                ? { type: 'paragraph' }
                : { type: 'paragraph', content: [{ type: 'text', text: line }] }),
        };
        return RichText.create({ text, html, json });
    }

    toString() {
        return this.text;
    }

    getDiffValue() {
        return this.text;
    }
}
