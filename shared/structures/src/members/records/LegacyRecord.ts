import { AutoEncoder, Data, Decoder, EnumDecoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';

import { LegacyRecordType,OldRecordType } from "./LegacyRecordType";

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

export class LegacyRecord extends AutoEncoder {
    @field({ decoder: new EnumDecoder(LegacyRecordType) })
    type: LegacyRecordType;

    @field({ decoder: StringDecoder })
    description = "";

    /**
     * Sometimes it is necessary to know who created a record.
     * So we keep track of this information in the background only when
     * someone inside the organization modified records
     */
    @field({ decoder: StringDecoder, optional: true })
    author?: string
}


/**
 * @deprecated only used for migration. Keep here for at least one year or create a migration that runs in the clients and saves
 */
export class OldRecord extends AutoEncoder {
    @field({ decoder: new TrimEnumDecoder(OldRecordType) })
    @field({ decoder: new EnumDecoder(OldRecordType), version: 34 })
    type: OldRecordType;

    @field({ decoder: StringDecoder })
    description = "";
}