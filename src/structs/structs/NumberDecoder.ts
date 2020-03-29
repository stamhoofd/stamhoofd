import { Decoder } from "../classes/Decoder";
import { Data } from "../classes/Data";

class NumberDecoder implements Decoder<number> {
    decode(data: Data): number {
        if (typeof data.value == "number") {
            return data.value;
        }

        throw new Error("Expected a number");
    }
}

// We export an instance to prevent creating a new instance every time we need to decode a number
export default new NumberDecoder();
