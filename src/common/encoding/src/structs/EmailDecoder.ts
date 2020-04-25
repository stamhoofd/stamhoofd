import { STError } from '@stamhoofd-common/errors';

import { Data } from "../classes/Data";
import { Decoder } from "../classes/Decoder";

class EmailDecoderStatic implements Decoder<string> {
    decode(data: Data): string {
        const str = data.string;
        const regex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

        if (!regex.test(str)) {
            throw new STError({
                code: "invalid_field",
                message: "Received an invalid email address",
                human: "Dit e-mailadres is ongeldig, kijk je het na?",
                field: data.currentField,
            });
        }
        return str;
    }
}

// We export an instance to prevent creating a new instance every time we need to decode a number
export const EmailDecoder = new EmailDecoderStatic();
