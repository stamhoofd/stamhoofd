import { Decoder } from "../classes/Decoder";
import { Data } from "../classes/Data";
import { ClientError } from "../../routing/classes/ClientError";

class NumberDecoder implements Decoder<number> {
    decode(data: Data): number {
        if (typeof data.value == "number" && !Number.isNaN(data.value) && Number.isFinite(data.value)) {
            return data.value;
        }

        throw new ClientError({
            code: "invalid_field",
            message: `Expected a number at ${data.currentField}`,
            field: data.currentField
        });
    }
}

// We export an instance to prevent creating a new instance every time we need to decode a number
export default new NumberDecoder();
