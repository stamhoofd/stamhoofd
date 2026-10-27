import { SimpleError } from '@simonbackx/simple-errors';

import { ArrayDecoder } from '../structs/ArrayDecoder.js';
import BooleanDecoder from '../structs/BooleanDecoder.js';
import { EnumDecoder } from '../structs/EnumDecoder.js';
import IntegerDecoder from '../structs/IntegerDecoder.js';
import { NullableDecoder } from '../structs/NullableDecoder.js';
import NumberDecoder from '../structs/NumberDecoder.js';
import StringDecoder from '../structs/StringDecoder.js';
import { Data } from './Data.js';
import { DecodedType, Decoder } from './Decoder.js';
import { EncodeContext } from './EncodeContext.js';

export function addIndexField(field: string | undefined, index: number) {
    if (!field) {
        return index + '';
    }
    return field + '.' + index;
}

export function addPropertyField(field: string | undefined, property: string) {
    if (!field) {
        return property;
    }
    return field + '.' + property;
}

export function addToField(field: string | undefined, b: string | number) {
    if (typeof b === 'number') {
        return addIndexField(field, b);
    }
    return addPropertyField(field, b);
}

/** Wraps parsed JSON or other plain data, retaining context and nested error paths. */
export class ObjectData implements Data {
    data: any;
    currentField: string;
    context: EncodeContext;

    constructor(data: any, context: EncodeContext, currentField = '') {
        this.data = data;
        this.currentField = currentField;
        this.context = context;
    }

    addToCurrentField(field: string | number): string {
        if (this.currentField.length === 0) {
            return field.toString();
        }
        return this.currentField + '.' + field;
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

    get integer(): number {
        return this.decode(IntegerDecoder);
    }

    get boolean(): boolean {
        return this.decode(BooleanDecoder);
    }

    equals<T>(value: T): T {
        if (this.data !== value) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Expected ' + value,
                field: this.currentField,
            });
        }
        return value;
    }

    /**
     * Request an item at a given index. Expects a defined, non null value
     * @param number index
     */
    index(number: number): Data {
        if (Array.isArray(this.value)) {
            if (!Number.isSafeInteger(number)) {
                throw new SimpleError({
                    code: 'invalid_index',
                    message: `Invalid index`,
                    field: this.currentField,
                });
            }
            if (this.data[number] !== undefined) {
                throw new SimpleError({
                    code: 'invalid_field',
                    message: `Expected value at ${this.addToCurrentField(number)}`,
                    field: this.addToCurrentField(number),
                });
            }
            return new ObjectData(this.data[number], this.context, this.addToCurrentField(number));
        }
        throw new SimpleError({
            code: 'invalid_field',
            message: `Expected an array${this.currentField ? ' at ' + this.currentField : ''}`,
            field: this.currentField,
        });
    }

    /**
     * Expects an optional field that could be null. Always returns undefined if the field is null or undefined.
     */
    optionalField(field: string): Data | undefined {
        if (this.data && this.data[field] !== undefined && this.data[field] !== null) {
            return new ObjectData(this.data[field], this.context, this.addToCurrentField(field));
        }
    }

    /**
     * Expects an optional field that could be null. Returns Data if the field value is null or not undefined
     */
    undefinedField(field: string): Data | undefined {
        if (this.data && this.data[field] !== undefined) {
            return new ObjectData(this.data[field], this.context, this.addToCurrentField(field));
        }
    }

    /**
     * Reads a defined field, including null. The decoder decides whether null is valid.
     * @throws A missing_field error when the field is undefined or absent.
     */
    field(field: string): Data {
        if (this.data && this.data[field] !== undefined) {
            return new ObjectData(this.data[field], this.context, this.addToCurrentField(field));
        }
        throw new SimpleError({
            code: 'missing_field',
            message: `Field ${field} is expected${this.currentField ? ' at ' + this.currentField : ''}`,
            field: this.currentField,
        });
    }

    array<T>(decoder: Decoder<T>): T[] {
        return new ArrayDecoder(decoder).decode(this);
    }

    decode<D extends Decoder<any>>(decoder: D): DecodedType<D> {
        return decoder.decode(this);
    }

    nullable<T>(decoder: Decoder<T>): T | null {
        return new NullableDecoder(decoder).decode(this);
    }

    enum<E extends { [key: number]: string | number }>(e: E): E[keyof E] {
        return new EnumDecoder(e).decode(this);
    }

    clone(set: { data: any; context: EncodeContext; field: string }): ObjectData {
        return new ObjectData(
            set.data,
            set.context,
            set.field,
        );
    }
}
