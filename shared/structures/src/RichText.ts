import { AutoEncoder, field, StringDecoder } from '@stamhoofd/common-encoding';

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
