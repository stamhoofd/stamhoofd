import { SimpleError } from '@simonbackx/simple-errors';
import { AutoEncoder } from './AutoEncoder.js';
import { Data } from './Data.js';
import { PlainObject } from './Encodeable.js';
import { EncodeContext } from './EncodeContext.js';

/** Validates encoded data and converts it into a value of type T. */
export interface Decoder<T> {
    /** Throws on invalid input; use data.currentField to identify the failing field. */
    decode(data: Data): T;
    /** Optional fast path used by AutoEncoder without constructing a Data wrapper. */
    decodeField?(data: unknown, context: EncodeContext, currentField?: string): T;

    /**
     * Optional encoding override. Otherwise values use their own encode method
     * or the library's encoding of plain values, arrays, and maps.
     */
    encode?(data: T, context: EncodeContext): PlainObject;

    /**
     * Default for missing required values and patching absent values.
     * Return undefined when no valid default exists.
     */
    getDefaultValue?(): T | undefined;
    /** Whether a value can be omitted during encoding and restored from the default. */
    isDefaultValue?(value: unknown): boolean;
}

export type DecodedType<D> = D extends typeof AutoEncoder ? InstanceType<D> : (D extends Decoder<infer C> ? C : never);
