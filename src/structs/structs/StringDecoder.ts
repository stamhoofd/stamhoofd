import { Decoder } from "../classes/Decoder";
import { Data } from "../classes/Data";

class StringDecoder implements Decoder<string> {
    decode(data: Data): string {
        if (typeof data.value == "string") {
            return data.value;
        }
        throw new Error("Expected a string");
    }
}

// We export an instance to prevent creating a new instance every time we need to decode a number
export default new StringDecoder();
