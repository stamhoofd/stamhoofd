import { Decoder } from './Decoder.js';
import { EncodeContext } from './EncodeContext.js';

/** Encoded data with decoding context and a field path for validation errors. */
export interface Data {
    readonly string: string;
    readonly number: number;
    readonly integer: number;
    readonly boolean: boolean;
    readonly value: any;

    context: EncodeContext;

    /// Contains the path where we are reading
    readonly currentField: string;
    addToCurrentField(field: string | number): string;

    /** Reads a defined field, including null; throws when missing. */
    field(field: string): Data;
    /** Returns undefined for a missing or null field. */
    optionalField(field: string): Data | undefined;
    /** Returns undefined for a missing field, but preserves null as Data. */
    undefinedField(field: string): Data | undefined;
    index(number: number): Data;
    decode<T>(decoder: Decoder<T>): T;
    nullable<T>(decoder: Decoder<T>): T | null;
    equals<T>(value: T): T;
    array<T>(decoder: Decoder<T>): T[];
    enum<E extends { [key: number]: string | number }>(e: E): E[keyof E];

    /**
     * Use this method to create a new instance of the same type, but with different field and data.
     */
    clone(set: { data: any; context: EncodeContext; field: string }): Data;
}
