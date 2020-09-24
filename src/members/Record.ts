import { AutoEncoder, Data, Decoder, EnumDecoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';

import { RecordType, RecordTypeHelper } from "./RecordType";

// Temporary fix for space in enum....
class TrimEnumDecoder<E extends { [key: number]: string | number }> implements Decoder<E[keyof E]> {
    enum: E;

    constructor(e: E) {
        this.enum = e;
    }

    decode(data: Data): E[keyof E] {
        let str: number | string;
        try {
            str = data.string.trim();
            if (Object.values(this.enum).includes(str)) {
                return str as E[keyof E];
            }
        } catch (e) {
            try {
                str = data.number;
                if (Object.values(this.enum).includes(str)) {
                    return str as E[keyof E];
                }
            } catch (e2) {
                throw new SimpleError({
                    code: "invalid_field",
                    message: `Expected a number or string for enum: ` + Object.values(this.enum).join(", "),
                    field: data.currentField,
                });
            }
        }

        throw new SimpleError({
            code: "invalid_field",
            message: "Unknown enum value " + str + " expected " + Object.values(this.enum).join(", "),
            field: data.currentField,
        });
    }
}


export class Record extends AutoEncoder {
    @field({ decoder: new TrimEnumDecoder(RecordType) })
    @field({ decoder: new EnumDecoder(RecordType), version: 34 })
    type: RecordType;

    @field({ decoder: StringDecoder })
    description = "";

    getText() {
        return RecordTypeHelper.getName(this.type);
    }
}
