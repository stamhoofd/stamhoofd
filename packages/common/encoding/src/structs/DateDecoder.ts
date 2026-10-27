import { SimpleError } from '@simonbackx/simple-errors';
import { Data } from '../classes/Data.js';
import { Decoder } from '../classes/Decoder.js';
import { EncodeContext } from '../classes/EncodeContext.js';

class DateDecoder implements Decoder<Date> {
    decode(data: Data): Date {
        return new Date(data.integer);
    }

    decodeField(data: unknown, _: EncodeContext, currentField?: string): Date {
        if (typeof data === 'number' && Number.isSafeInteger(data)) {
            return new Date(data);
        }

        if (typeof data === 'string') {
            const parsed = Number.parseInt(data);
            if (!isNaN(parsed)) {
                return new Date(parsed);
            }
        }

        throw new SimpleError({
            code: 'invalid_field',
            message: `Expected an integer (Date) at ${currentField}`,
            field: currentField,
        });
    }
}

// Fix encoding of dates
declare global {
    interface Date {
        encode: (context: EncodeContext) => number;
    }
}

Date.prototype.encode = function (this: Date, context: EncodeContext): number {
    return this.getTime();
};

// We export an instance to prevent creating a new instance every time we need to decode a number
export default new DateDecoder();
