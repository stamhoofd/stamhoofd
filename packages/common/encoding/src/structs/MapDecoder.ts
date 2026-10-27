import { SimpleError } from '@simonbackx/simple-errors';

import { Data } from '../classes/Data.js';
import { Decoder } from '../classes/Decoder.js';
import { addPropertyField, ObjectData } from '../classes/ObjectData.js';
import { PatchMap } from '../classes/Patchable.js';
import { NullableDecoder } from './NullableDecoder.js';
import { PatchOrPutDecoder } from './PatchOrPutDecoder.js';
import { EncodeContext } from '../classes/EncodeContext.js';

export class MapDecoder<A, B> implements Decoder<Map<A, B>> {
    keyDecoder: Decoder<A>;
    valueDecoder: Decoder<B>;

    constructor(keyDecoder: Decoder<A>, valueDecoder: Decoder<B>) {
        this.keyDecoder = keyDecoder;
        this.valueDecoder = valueDecoder;
    }

    patchType() {
        const elementDecoder = this.valueDecoder;
        if ((elementDecoder as any).patchType) {
            const patchDecoder = (elementDecoder as any).patchType();
            return new PatchMapDecoder(this.keyDecoder, new NullableDecoder(new PatchOrPutDecoder(this.valueDecoder as any, patchDecoder)));
        }

        return new PatchMapDecoder(this.keyDecoder, new NullableDecoder(this.valueDecoder));
    }

    patchDefaultValue() {
        return new PatchMap();
    }

    isPatchDefaultValue(value: unknown): boolean {
        // Note: we cannot optimize here without instanceof - because setting it to a map is not the same as setting
        // typeof is too slow, so we optimize it here
        return typeof value === 'object' && value !== null && (value as any)._isPatchMap && (value as any).size === 0;
    }

    decodeField(value: unknown, context: EncodeContext, currentField?: string): Map<A, B> {
        if (typeof value === 'object' && value !== null) {
            const map = new Map<A, B>();
            for (const key in value) {
                const field = addPropertyField(currentField, key);
                map.set(
                    this.keyDecoder.decodeField ? this.keyDecoder.decodeField(key, context, field) : new ObjectData(key, context, field).decode(this.keyDecoder),
                    this.valueDecoder.decodeField ? this.valueDecoder.decodeField(value[key], context, field) : new ObjectData(value[key], context, field).decode(this.valueDecoder),
                );
            }
            return map;
        }

        throw new SimpleError({
            code: 'invalid_field',
            message: `Expected an object at ${currentField}`,
            field: currentField,
        });
    }

    decode(data: Data): Map<A, B> {
        return this.decodeField(data.value, data.context, data.currentField);
    }

    isDefaultValue(value: unknown): boolean {
        // typeof is too slow, so we optimize it here
        return /* value instanceof Map && */ typeof value === 'object' && (value as any).size !== undefined && (value as any).size === 0;
    }

    getDefaultValue(): Map<A, B> {
        return new Map();
    }
}

export class PatchMapDecoder<A, B> implements Decoder<PatchMap<A, B>> {
    keyDecoder: Decoder<A>;
    valueDecoder: Decoder<B>;

    constructor(keyDecoder: Decoder<A>, valueDecoder: Decoder<B>) {
        this.keyDecoder = keyDecoder;
        this.valueDecoder = valueDecoder;
    }

    decode(container: Data): PatchMap<A, B> {
        const data = container.field('changes');

        if (typeof data.value === 'object' && data.value !== null) {
            const map = new PatchMap<A, B>();
            for (const key in data.value) {
                const keyDecoded = data.clone({
                    data: key,
                    context: data.context,
                    field: data.addToCurrentField(key),
                }).decode(this.keyDecoder);
                const valueDecoded = data.field(key).decode(this.valueDecoder);
                map.set(keyDecoded, valueDecoded);
            }
            return map;
        }

        throw new SimpleError({
            code: 'invalid_field',
            message: `Expected an object at ${data.currentField}`,
            field: data.currentField,
        });
    }

    isDefaultValue(value: unknown): boolean {
        return value instanceof PatchMap && value.size === 0;
    }

    getDefaultValue(): PatchMap<A, B> {
        return new PatchMap();
    }
}
