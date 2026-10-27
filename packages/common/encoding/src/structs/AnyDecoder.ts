import { Data } from '../classes/Data.js';
import { Decoder } from '../classes/Decoder.js';

class AnyDecoder implements Decoder<any> {
    decode(data: Data): any {
        return data.value;
    }
}

export default new AnyDecoder();
