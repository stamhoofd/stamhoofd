import { Decoder } from "./Decoder";

/// Decode data that is structured in maps and arrays
export interface Data {
    readonly string: string;
    readonly number: number;
    readonly value: any;

    /// Contains the path where we are reading
    readonly currentField: string;

    field(field: string): Data;
    optionalField(field: string): Data | undefined;
    index(number: number): Data;
    decode<T>(decoder: Decoder<T>): T;
    array<T>(decoder: Decoder<T>): T[];
}
