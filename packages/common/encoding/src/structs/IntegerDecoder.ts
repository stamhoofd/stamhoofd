import { SimpleError } from '@simonbackx/simple-errors';

import { Data } from '../classes/Data.js';
import { Decoder } from '../classes/Decoder.js';
import { EncodeContext } from '../classes/EncodeContext.js';

class IntegerDecoder implements Decoder<number> {
    decode(data: Data): number {
        if (typeof data.value === 'number' && Number.isSafeInteger(data.value)) {
            return data.value;
        }

        if (typeof data.value === 'string') {
            const parsed = Number.parseInt(data.value);
            if (!isNaN(parsed)) {
                return parsed;
            }
        }

        throw new SimpleError({
            code: 'invalid_field',
            message: `Expected an integer at ${data.currentField}`,
            field: data.currentField,
        });
    }

    decodeField(data: unknown, _: EncodeContext, currentField?: string): number {
        if (typeof data === 'number' && Number.isSafeInteger(data)) {
            return data;
        }

        if (typeof data === 'string') {
            const parsed = Number.parseInt(data);
            if (!isNaN(parsed)) {
                return parsed;
            }
        }

        throw new SimpleError({
            code: 'invalid_field',
            message: `Expected an integer at ${currentField}`,
            field: currentField,
        });
    }
}

// We export an instance to prevent creating a new instance every time we need to decode a number
export default new IntegerDecoder();
