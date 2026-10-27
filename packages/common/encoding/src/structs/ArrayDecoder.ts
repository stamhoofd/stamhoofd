import { SimpleError } from '@simonbackx/simple-errors';

import { AutoEncoder } from '../classes/AutoEncoder.js';
import { Data } from '../classes/Data.js';
import { Decoder } from '../classes/Decoder.js';
import { PatchableArray, PatchableArrayDecoder } from './PatchableArray.js';
import StringOrNumberDecoder from './StringOrNumberDecoder.js';
import { isPatchableArray } from '../classes/Patchable.js';
import { EncodeContext } from '../classes/EncodeContext.js';
import { addIndexField, ObjectData } from '../classes/ObjectData.js';

export class ArrayDecoder<T> implements Decoder<T[]> {
    decoder: Decoder<T>;

    constructor(decoder: Decoder<T>) {
        this.decoder = decoder;
    }

    decodeField(value: unknown, context: EncodeContext, currentField?: string): T[] {
        if (Array.isArray(value)) {
            if (this.decoder.decodeField) {
                const arr = new Array(value.length);
                for (let i = 0; i < arr.length; i++) {
                    arr[i] = this.decoder.decodeField(value[i], context, addIndexField(currentField, i));
                }
                return arr;
            }
            else {
                const arr = new Array(value.length);
                for (let i = 0; i < arr.length; i++) {
                    arr[i] = new ObjectData(value[i], context, addIndexField(currentField, i)).decode(this.decoder);
                }
                return arr;
            }
        }

        throw new SimpleError({
            code: 'invalid_field',
            message: `Expected an array at ${currentField}`,
            field: currentField,
        });
    }

    decode(data: Data): T[] {
        const value = data.value;
        if (Array.isArray(value)) {
            if (this.decoder.decodeField) {
                const arr = new Array(value.length);
                for (let i = 0; i < arr.length; i++) {
                    arr[i] = this.decoder.decodeField(value[i], data.context, data.addToCurrentField(i));
                }
                return arr;
            }
            else {
                const arr = new Array(value.length);
                for (let i = 0; i < arr.length; i++) {
                    arr[i] = data.clone({
                        data: value[i],
                        context: data.context,
                        field: data.addToCurrentField(i),
                    }).decode(this.decoder);
                }
                return arr;
            }
        }

        throw new SimpleError({
            code: 'invalid_field',
            message: `Expected an array at ${data.currentField}`,
            field: data.currentField,
        });
    }

    patchType() {
        const elementDecoder = this.decoder;
        if ((elementDecoder as any).patchType) {
            const patchDecoder = (elementDecoder as any).patchType();

            // Check if we have a method called "getIdentifier"
            let idFieldType: Decoder<string | number> | undefined;

            if ((elementDecoder as any).patchIdentifier) {
                // Custom identifier (in case no automatic detection is possible)
                idFieldType = (elementDecoder as any).patchIdentifier();
            }
            else {
                if (patchDecoder.prototype.getIdentifier) {
                    // This autoencoder uses the getIdentifier method to define the id
                    idFieldType = StringOrNumberDecoder;
                }
                else {
                    const field = (elementDecoder as typeof AutoEncoder).fields.find(field => field.property == 'id');
                    if (field) {
                        idFieldType = field.decoder;
                    }
                }
            }

            if (idFieldType) {
                return new PatchableArrayDecoder<any, any, any>(elementDecoder as any, patchDecoder, idFieldType as any);
            }
            else {
                // A non identifiable array -> we expect an optional array instead = default behaviour
                // upgrade / downgrade kan stay the same as default

                // We expect a normal array, of same type
                return this;
            }
        }
        // Upgrade / downgrades cannot work when pathcing, should be placed on instances
        // field.upgrade = this.upgradePatch
        // field.downgrade = this.downgradePatch

        return new PatchableArrayDecoder<any, any, any>(elementDecoder as any, elementDecoder as any, elementDecoder as any);
    }

    /**
     * @deprecated
     * use patchType().getDefaultValue instead
     * Patchable values of an array always create a default empty patchable array for convenience
     */
    patchDefaultValue() {
        const elementDecoder = this.decoder;
        if ((elementDecoder as any).patchType) {
            const patchDecoder = (elementDecoder as any).patchType();

            // Check if we have a method called "getIdentifier"
            let idFieldType: Decoder<string | number> | undefined;

            if ((elementDecoder as any).patchIdentifier) {
                // Custom identifier (in case no automatic detection is possible)
                idFieldType = (elementDecoder as any).patchIdentifier();
            }
            else {
                if (patchDecoder.prototype.getIdentifier) {
                    // This autoencoder uses the getIdentifier method to define the id
                    idFieldType = StringOrNumberDecoder;
                }
                else {
                    const field = (elementDecoder as typeof AutoEncoder).fields.find(field => field.property == 'id');
                    if (field) {
                        idFieldType = field.decoder;
                    }
                }
            }

            if (idFieldType) {
                return new PatchableArray<any, any, any>();
            }
            else {
                // A non identifiable array -> we expect an optional array instead = default behaviour
                // upgrade / downgrade kan stay the same as default

                // We expect a normal array, of same type
                return undefined;
            }
        }
        return new PatchableArray<any, any, any>();
    }

    isPatchDefaultValue(value: unknown): boolean {
        return isPatchableArray(value) && value.changes.length === 0;
    }

    isDefaultValue(value: unknown): boolean {
        return Array.isArray(value) && value.length === 0;
    }

    getDefaultValue(): T[] {
        return [];
    }
}
