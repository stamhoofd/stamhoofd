import { AutoEncoder, field, StringDecoder } from '@common/encoding';

export class RichText extends AutoEncoder {
    @field({ decoder: StringDecoder })
    html = '';

    @field({ decoder: StringDecoder })
    text = '';

    toString() {
        return this.text;
    }

    getDiffValue() {
        return this.text;
    }
}
