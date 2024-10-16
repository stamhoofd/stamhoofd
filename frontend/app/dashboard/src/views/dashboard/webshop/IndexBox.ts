import { Data, Decoder, EncodableObject, Encodeable, EncodeContext, encodeObject } from '@simonbackx/simple-encoding';

export type IndexedDbIndexValue = string | number | null | undefined;
export type IndexMap<Key = string> = Map<Key, IndexedDbIndexValue>;
export type GetIndexes<Data, T extends EncodableObject = EncodableObject> = (data: Data) => T;

export class IndexBox<T extends EncodableObject> implements Encodeable {
    readonly data: T;
    readonly getIndexes: GetIndexes<T>;

    constructor({ data, getIndexes }: { data: T; getIndexes: GetIndexes<T> }) {
        this.data = data;
        this.getIndexes = getIndexes;
    }

    encode(context: EncodeContext) {
        return {
            value: encodeObject(this.data, context),
            indexes: encodeObject(this.getIndexes(this.data), context),
            version: context.version,
        };
    }
}

export class IndexBoxDecoder<T extends EncodableObject> implements Decoder<T> {
    constructor(readonly decoder: Decoder<T>) {
    }

    decode(data: Data): T {
        // Set the version of the decoding context of "value"
        const valueField = data.field('value');
        valueField.context.version = data.field('version').integer;
        return valueField.decode(this.decoder);
    }
}
