import { Decoder } from './Decoder';
import { Data } from './Data';

export class ArrayDecoder<T> implements Decoder<T[]> {
    decoder: Decoder<T>;
    constructor(decoder: Decoder<T>) {
        this.decoder = decoder;
    }

    decode(data: any): T[] {
        if (Array.isArray(data)) {
            return data.map(el => this.decoder.decode(el))
        } else {
            if (data.value && Array.isArray(data.value)) {
                // Data
                return (data.array as (Data[])).map(el => this.decoder.decode(el))
            }
        }
        throw new Error("Expected an array");
    }
}