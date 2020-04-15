import { Data } from "./Data";
import { Decoder } from "./Decoder";
import StringDecoder from "../structs/StringDecoder";
import NumberDecoder from "../structs/NumberDecoder";
import ArrayDecoder from "../structs/ArrayDecoder";
import { DecodingError } from "../classes/DecodingError";
import Base64Decoder from "../structs/Base64Decoder";
import KeyDecoder from "../structs/KeyDecoder";

/// Implementation of Data that reads an already existing tree of data.
export class ObjectData implements Data {
    data: any;
    currentField: string;

    constructor(data: any, currentField = "") {
        this.data = data;
        this.currentField = currentField;
    }

    private addToCurrentField(field: string | number): string {
        if (this.currentField == "") {
            return field + "";
        }
        return this.currentField + "." + field;
    }

    get value(): any {
        return this.data;
    }

    get string(): string {
        return this.decode(StringDecoder);
    }

    get base64(): string {
        return this.decode(Base64Decoder);
    }

    get key(): string {
        return this.decode(KeyDecoder);
    }

    get number(): number {
        return this.decode(NumberDecoder);
    }

    /**
     * Request an item at a given index. Expects a defined, non null value
     * @param number index
     */
    index(number: number): Data {
        if (Array.isArray(this.value)) {
            if (!Number.isSafeInteger(number)) {
                throw new DecodingError({
                    code: "invalid_index",
                    message: `Invalid index`,
                    field: this.currentField,
                });
            }
            if (this.data[number] !== undefined) {
                throw new DecodingError({
                    code: "invalid_field",
                    message: `Expected value at ${this.addToCurrentField(number)}`,
                    field: this.addToCurrentField(number),
                });
            }
            return new ObjectData(this.data[number], this.addToCurrentField(number));
        }
        throw new DecodingError({
            code: "invalid_field",
            message: `Expected an array at ${this.currentField}`,
            field: this.currentField,
        });
    }

    /**
     * Expects an optional field that could be null. Always returns undefined if the field is null or undefined.
     */
    optionalField(field: string): Data | undefined {
        if (this.data && this.data[field] !== undefined && this.data[field] !== null) {
            return new ObjectData(this.data[field], this.addToCurrentField(field));
        }
    }

    /**
     * Expects an existing field that is defined and not null
     */
    field(field: string): Data {
        if (this.data && this.data[field] !== undefined && this.data[field] !== null) {
            return new ObjectData(this.data[field], this.addToCurrentField(field));
        }
        throw new DecodingError({
            code: "missing_field",
            message: `Field ${field} is expected at ${this.currentField}`,
            field: this.currentField,
        });
    }

    array<T>(decoder: Decoder<T>): T[] {
        const array = ArrayDecoder.decode(this);
        return array.map((v) => decoder.decode(v));
    }

    decode<T>(decoder: Decoder<T>): T {
        return decoder.decode(this);
    }
}
