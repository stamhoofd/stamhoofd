import { SimpleError } from '@common/errors';

import { Data } from '../classes/Data.js';
import { Decoder } from '../classes/Decoder.js';
import { PatchMap } from '../classes/Patchable.js';

/** Decodes incremental map changes; MapDecoder decodes full dictionary values. */
export class PatchMapDecoder<A, B> implements Decoder<PatchMap<A, B>> {
    keyDecoder: Decoder<A>;
    valueDecoder: Decoder<B>;

    constructor(keyDecoder: Decoder<A>, valueDecoder: Decoder<B>) {
        this.keyDecoder = keyDecoder;
        this.valueDecoder = valueDecoder;
    }

    decode(container: Data): PatchMap<A, B> {
        const data = container.field('changes');

        if (typeof data.value === 'object' && data.value !== null) {
            const map = new PatchMap<A, B>();
            for (const key of Object.keys(data.value)) {
                const keyDecoded = data.clone({
                    data: key,
                    context: data.context,
                    field: data.addToCurrentField(key),
                }).decode(this.keyDecoder);
                const valueDecoded = data.field(key).decode(this.valueDecoder);
                map.set(keyDecoded, valueDecoded);
            }
            return map;
        }

        throw new SimpleError({
            code: 'invalid_field',
            message: `Expected an object at ${data.currentField}`,
            field: data.currentField,
        });
    }

    isDefaultValue(value: unknown): boolean {
        return value instanceof PatchMap && value.size === 0;
    }

    getDefaultValue(): PatchMap<A, B> {
        return new PatchMap();
    }
}
