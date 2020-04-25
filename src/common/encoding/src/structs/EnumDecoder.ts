import { STError } from '@stamhoofd-common/errors';

import { Data } from "../classes/Data";
import { Decoder } from "../classes/Decoder";

export class EnumDecoder<E extends { [key: number]: string | number }> implements Decoder<E[keyof E]> {
    enum: E;

    constructor(e: E) {
        this.enum = e;
    }

    decode(data: Data): E[keyof E] {
        const str = data.string;
        if (Object.values(this.enum).includes(str)) {
            return str as E[keyof E];
        }
        throw new STError({
            code: "invalid_field",
            message: "Unknown enum value " + str + " expected " + Object.values(this.enum).join(", "),
            field: data.currentField
        })
    }
}

