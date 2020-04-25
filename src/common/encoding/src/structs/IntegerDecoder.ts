import { STError } from '@stamhoofd-common/errors';

import { Data } from "../classes/Data";
import { Decoder } from "../classes/Decoder";

class IntegerDecoder implements Decoder<number> {
    decode(data: Data): number {
        if (typeof data.value == "number" && Number.isSafeInteger(data.value)) {
            return data.value;
        }

        throw new STError({
            code: "invalid_field",
            message: `Expected an integer at ${data.currentField}`,
            field: data.currentField
        });
    }
}

// We export an instance to prevent creating a new instance every time we need to decode a number
export default new IntegerDecoder();
