import { Decoder } from "../classes/Decoder";
import { Data } from "../classes/Data";
import { DecodingError } from "../classes/DecodingError";

export class EnumDecoder<E extends { [key: number]: string | number }> implements Decoder<E[keyof E]> {
    enum: E;

    constructor(e: E) {
        this.enum = e;
    }

    decode(data: Data): E[keyof E] {
        const str = data.string;
        if (Object.keys(this.enum).includes(str)) {
            return str as E[keyof E];
        }
        throw new DecodingError({
            code: "invalid_field",
            message: "Unknown enum value for " + this.enum.constructor.name,
            field: data.currentField
        })
    }
}

