import { Decoder } from './Decoder';

export class StringDecoder /* static implements Decoder<string> */ {
    static decode(data: any): string {
        if (typeof data == "string") {
            return data as string;
        }
        throw new Error("Expected a string");
    }
}