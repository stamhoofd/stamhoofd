import { Decoder } from './Decoder';
import { ContentDecoder } from './ContentDecoder';

/// Decode data that is structured in maps and arrays
export interface Data {
    readonly string: string;
    readonly number: number;
    readonly value: any;

    field(field: string): Data;
    index(number: number): Data;
    decode<T>(decoder: Decoder<T>): T;
    decodeContent<T>(contentType: string, decoder: ContentDecoder<Data, T>): T;

}