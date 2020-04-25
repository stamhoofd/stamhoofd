import { STError } from '@stamhoofd-common/errors';

import { Data } from "../classes/Data";
import { Decoder } from "../classes/Decoder";

class StringDecoder implements Decoder<string> {
    decode(data: Data): string {
        if (typeof data.value == "string") {
            return data.value;
        }
        throw new STError({
            code: "invalid_field",
            message: `Expected a string at ${data.currentField}`,
            field: data.currentField
        });
    }
}

// We export an instance to prevent creating a new instance every time we need to decode a number
export default new StringDecoder();
