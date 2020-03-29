import { Data } from "./Data";
import { Decoder } from "./Decoder";
import StringDecoder from "../structs/StringDecoder";
import NumberDecoder from "../structs/NumberDecoder";
import ArrayDecoder from "../structs/ArrayDecoder";

/// Implementation of Data that reads an already existing tree of data.
export class ObjectData implements Data {
    data: any;

    constructor(data: any) {
        this.data = data;
    }

    get value(): any {
        return this.data;
    }

    get string(): string {
        return this.decode(StringDecoder);
    }

    get number(): number {
        return this.decode(NumberDecoder);
    }

    index(number: number): Data {
        if (Array.isArray(this.value)) {
            if (!Number.isInteger(number)) {
                throw new Error("Invalid index " + number);
            }
            if (this.data[number] !== undefined) {
                throw new Error("Expected an item at index " + number);
            }
            return new ObjectData(this.data[number]);
        }
        throw new Error("Expected an array");
    }

    field(field: string): Data {
        if (this.data && this.data[field]) {
            return new ObjectData(this.data[field]);
        }
        throw new Error(`Field ${field} expected`);
    }

    array<T>(decoder: Decoder<T>): T[] {
        const array = ArrayDecoder.decode(this);
        return array.map(v => decoder.decode(v));
    }

    decode<T>(decoder: Decoder<T>): T {
        return decoder.decode(this);
    }
}
