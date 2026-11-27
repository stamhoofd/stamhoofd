import { AnyDecoder, AutoEncoder, field, StringDecoder } from '@common/encoding';

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

    toString() {
        return this.text;
    }

    getDiffValue() {
        return this.text;
    }
}
