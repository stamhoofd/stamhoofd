import { SimpleError } from '@simonbackx/simple-errors';

import { Data } from '../classes/Data.js';
import { Decoder } from '../classes/Decoder.js';
import { EncodeContext } from '../classes/EncodeContext.js';

class NumberDecoder implements Decoder<number> {
    decode(data: Data): number {
        if (typeof data.value === 'number' && !Number.isNaN(data.value) && Number.isFinite(data.value)) {
            return data.value;
        }

        throw new SimpleError({
            code: 'invalid_field',
            message: `Expected a number at ${data.currentField}`,
            field: data.currentField,
        });
    }

    decodeField(data: unknown, _: EncodeContext, currentField?: string): number {
        if (typeof data === 'number' && !Number.isNaN(data) && Number.isFinite(data)) {
            return data;
        }

        throw new SimpleError({
            code: 'invalid_field',
            message: `Expected a number at ${currentField}`,
            field: currentField,
        });
    }
}

// We export an instance to prevent creating a new instance every time we need to decode a number
export default new NumberDecoder();
