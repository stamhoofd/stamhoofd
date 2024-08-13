import { Decoder, Data } from "@simonbackx/simple-encoding";

export class StringNullableDecoder<T> implements Decoder<T | null> {
    decoder: Decoder<T>;

    constructor(decoder: Decoder<T>) {
        this.decoder = decoder;
    }

    decode(data: Data): T | null {
        if (data.value === 'null') {
            return null;
        }

        return data.decode(this.decoder);
    }
}

