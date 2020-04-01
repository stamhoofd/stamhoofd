import { Decoder } from "../classes/Decoder";
import { Data } from "../classes/Data";
import { ObjectData } from "../classes/ObjectData";
import { ClientError } from "../../routing/classes/ClientError";

class ArrayDecoder implements Decoder<Data[]> {
    decode(data: Data): Data[] {
        if (Array.isArray(data.value)) {
            return data.value.map(v => new ObjectData(v));
        }

        throw new ClientError({
            code: "invalid_field",
            message: `Expected an array at ${data.currentField}`,
            field: data.currentField
        });
    }
}

// We export an instance to prevent creating a new instance every time we need to decode a number
export default new ArrayDecoder();
