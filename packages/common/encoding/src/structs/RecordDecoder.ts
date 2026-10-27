import { SimpleError } from '@common/errors';

import { Data } from '../classes/Data.js';
import { Decoder } from '../classes/Decoder.js';

/**
 * @deprecated Use MapDecoder for dynamic dictionaries. For fixed-shape objects,
 * use an appropriate object decoder preserving their partial/unknown-key contract.
 */
export class RecordDecoder<A extends keyof any, B> implements Decoder<Record<A, B>> {
    keyDecoder: Decoder<A>;
    valueDecoder: Decoder<B>;

    constructor(keyDecoder: Decoder<A>, valueDecoder: Decoder<B>) {
        this.keyDecoder = keyDecoder;
        this.valueDecoder = valueDecoder;
    }

    decode(data: Data): Record<A, B> {
        if (typeof data.value === 'object' && data.value !== null) {
            const map: Record<A, B> = {} as any;
            for (const key of Object.keys(data.value)) {
                const keyDecoded = data.clone({
                    data: key,
                    context: data.context,
                    field: data.addToCurrentField(key),
                }).decode(this.keyDecoder);
                const valueDecoded = data.field(key).decode(this.valueDecoder);
                Object.defineProperty(map, keyDecoded, { value: valueDecoded, enumerable: true, configurable: true, writable: true });
            }
            return map;
        }

        throw new SimpleError({
            code: 'invalid_field',
            message: `Expected an object at ${data.currentField}`,
            field: data.currentField,
        });
    }
}
