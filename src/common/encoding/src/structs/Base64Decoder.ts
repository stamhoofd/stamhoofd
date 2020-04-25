import { STError } from '@stamhoofd-common/errors';

import { Data } from "../classes/Data";
import { Decoder } from "../classes/Decoder";

class Base64Decoder implements Decoder<string> {
    decode(data: Data): string {
        const str = data.string;

        const base64regex = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
        if (!base64regex.test(str)) {
            throw new STError({
                code: "invalid_field",
                message: "Expected a valid base64 encoded string, received " + str,
                field: data.currentField,
            });
        }
        return str;
    }
}

// We export an instance to prevent creating a new instance every time we need to decode a number
export default new Base64Decoder();
