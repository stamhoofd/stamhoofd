import { SimpleError } from '@simonbackx/simple-errors';

import { Data } from '../classes/Data.js';
import { Decoder } from '../classes/Decoder.js';
import StringDecoder from './StringDecoder.js';
import { EncodeContext } from '../classes/EncodeContext.js';
import NumberDecoder from './NumberDecoder.js';

export class EnumDecoder<E extends { [key: number]: string | number }> implements Decoder<E[keyof E]> {
    enum: E;

    constructor(e: E) {
        this.enum = e;
    }

    decodeField(data: unknown, context: EncodeContext, currentField?: string): E[keyof E] {
        let str: number | string;
        try {
            str = StringDecoder.decodeField(data, context, currentField);
            if (Object.values(this.enum).includes(str)) {
                return str as E[keyof E];
            }
        }
        catch (e) {
            try {
                str = NumberDecoder.decodeField(data, context, currentField);
                if (Object.values(this.enum).includes(str)) {
                    return str as E[keyof E];
                }
            }
            catch (e2) {
                throw new SimpleError({
                    code: 'invalid_field',
                    message: `Expected a number or string for enum: ` + Object.values(this.enum).join(', '),
                    field: currentField,
                });
            }
        }

        throw new SimpleError({
            code: 'invalid_field',
            message: 'Unknown enum value ' + str + ' expected ' + Object.values(this.enum).join(', '),
            field: currentField,
        });
    }

    decode(data: Data): E[keyof E] {
        let str: number | string;
        try {
            str = data.string;
            if (Object.values(this.enum).includes(str)) {
                return str as E[keyof E];
            }
        }
        catch (e) {
            try {
                str = data.number;
                if (Object.values(this.enum).includes(str)) {
                    return str as E[keyof E];
                }
            }
            catch (e2) {
                throw new SimpleError({
                    code: 'invalid_field',
                    message: `Expected a number or string for enum: ` + Object.values(this.enum).join(', '),
                    field: data.currentField,
                });
            }
        }

        throw new SimpleError({
            code: 'invalid_field',
            message: 'Unknown enum value ' + str + ' expected ' + Object.values(this.enum).join(', '),
            field: data.currentField,
        });
    }
}
