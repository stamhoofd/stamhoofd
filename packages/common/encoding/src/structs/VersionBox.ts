import { Data } from '../classes/Data.js';
import { Decoder } from '../classes/Decoder.js';
import { EncodableObject, Encodeable, encodeObject } from '../classes/Encodeable.js';
import { EncodeContext } from '../classes/EncodeContext.js';

/**
 * Stores an encoding version alongside data as { version, data }, so persisted
 * data can be decoded using its original format rather than the current version.
 */
export class VersionBox<T extends EncodableObject> implements Encodeable {
    data: T;

    constructor(data: T) {
        this.data = data;
    }

    encode(context: EncodeContext) {
        return {
            data: encodeObject(this.data, context),
            version: context.version,
        };
    }
}

/** Decodes a versioned envelope and returns a VersionBox; access the value through .data. */
export class VersionBoxDecoder<T extends EncodableObject> implements Decoder<VersionBox<T>> {
    decoder: Decoder<T>;

    constructor(decoder: Decoder<T>) {
        this.decoder = decoder;
    }

    /**
     * Replaces the supplied context.version with the envelope's version before
     * decoding its payload. ObjectData children share that context, so use a
     * fresh context when this must not affect other decoding operations.
     */
    decode(data: Data): VersionBox<T> {
        // Set the version of the decoding context of "data"
        const context = data.field('data');
        context.context.version = data.field('version').integer;

        return new VersionBox<T>(context.decode(this.decoder));
    }
}
