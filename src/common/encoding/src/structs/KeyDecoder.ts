import { STError } from '@stamhoofd-common/errors';

import { Data } from "../classes/Data";
import { Decoder } from "../classes/Decoder";

class KeyDecoder implements Decoder<string> {
    decode(data: Data): string {
        const str = data.base64;

        const buffer = Buffer.from(str, "base64");

        if (buffer.length != 32) {
            throw new STError({
                code: "invalid_field",
                message: "Invalid key. Expected 32 byte key",
                field: data.currentField,
            });
        }
        return str;
    }
}

// We export an instance to prevent creating a new instance every time we need to decode a number
export default new KeyDecoder();
