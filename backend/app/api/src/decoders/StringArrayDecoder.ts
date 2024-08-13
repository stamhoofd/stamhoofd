import { Data, Decoder } from "@simonbackx/simple-encoding";

export class StringArrayDecoder<T> implements Decoder<T[]> {
    decoder: Decoder<T>;

    constructor(decoder: Decoder<T>) {
        this.decoder = decoder;
    }

    decode(data: Data): T[] {
        const strValue = data.string;

        // Split on comma
        const parts = strValue.split(",");
        return parts
            .map((v, index) => {
                return data.clone({ 
                    data: v, 
                    context: data.context, 
                    field: data.addToCurrentField(index) 
                }).decode(this.decoder)
            });
    }
}
