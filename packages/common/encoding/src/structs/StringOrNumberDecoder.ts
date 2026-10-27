import { SimpleError } from '@simonbackx/simple-errors';

import { Data } from '../classes/Data.js';
import { Decoder } from '../classes/Decoder.js';

class StringOrNumberDecoder implements Decoder<string | number> {
    decode(data: Data): string | number {
        if (typeof data.value === 'string') {
            return data.value;
        }
        if (typeof data.value === 'number' && !Number.isNaN(data.value) && Number.isFinite(data.value)) {
            return data.value;
        }
        throw new SimpleError({
            code: 'invalid_field',
            message: `Expected a string or number at ${data.currentField}`,
            field: data.currentField,
        });
    }
}

// We export an instance to prevent creating a new instance every time we need to decode a number
export default new StringOrNumberDecoder();
