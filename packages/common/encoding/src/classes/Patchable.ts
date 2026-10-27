import { PatchableArray } from '../structs/PatchableArray.js';
import { AutoEncoder } from './AutoEncoder.js';
import { Encodeable } from './Encodeable.js';
import { EncodeContext } from './EncodeContext.js';
import { NonScalarIdentifiable } from './Identifiable.js';
import { Cloneable, cloneObject } from './Cloneable.js';
import { SimpleError } from '@simonbackx/simple-errors';
import { isAutoEncoder } from '../helpers/isAutoEncoder.js';

/** An object that can apply a patch of type P. AutoEncoder supplies this behavior automatically. */
export interface Patchable<P> {
    patch(patch: P): this;
}

/** Infers manual patch types; use AutoEncoderPatchType for AutoEncoder subclasses. */
export type PatchType<T> = T extends Patchable<infer P> ? P : (T | undefined);

export function isPatchable<T>(object: T): object is T & Patchable<any> {
    if (!object) {
        return false;
    }
    return !!(object as any).patch;
}

export function patchContainsChanges<B extends Encodeable & Patchable<B>, A extends PatchType<B>>(patch: A, model: B, context: EncodeContext): boolean {
    const patched = model.patch(patch);
    return JSON.stringify(patched.encode(context)) != JSON.stringify(model.encode(context));
}

export type ConvertArrayToPatchableArray<T> =
    T extends AutoEncoder ?
        T | AutoEncoderPatchType<T> | undefined // This is needed to help Typescript Understand to keep T instead of just generalizing to AutoEncoderPatchType<AutoEncoder>
        : T extends PatchableArray<any, any, any>
            ? T :
                (T extends Array<infer P>
                    ? (P extends string
                            ? PatchableArray<string, string, string>
                            : P extends number
                                ? PatchableArray<number, number, number>
                                : P extends AutoEncoder
                                    ? PatchableArrayAutoEncoder<P>
                                    : T | undefined)
                    : (
                            T extends Map<infer T, infer P> ?
                                    (/* Map<T, P> | */ PatchMap<T, P | ConvertArrayToPatchableArray<P> | null>)
                                : PatchType<T> | undefined
                        ))
    ;

type NonMethodKeys<T> = {
    [K in keyof T]: T[K] extends Function ? never : K
}[keyof T];

export type PartialWithoutMethods<Base> = Partial<Pick<Base, NonMethodKeys<Base>>>;

type GetOptionalPropertiesOfHelper<Base> = {
    [Key in keyof Base]: Base[Key] extends string | number | Array<any> | Function | boolean | Record<string, any> ? never : Key;
};
type GetOptionalPropertiesOf<Base> = Exclude<GetOptionalPropertiesOfHelper<Base>[keyof Base], undefined>;

type MakeOptionalRealOptionalHelper<Base> = {
    [Key in GetOptionalPropertiesOf<Base>]?: Base[Key];
} &
{
    [Key in Exclude<keyof Base, GetOptionalPropertiesOf<Base>>]: Base[Key];
};
type MakeOptionalRealOptional<Base> = {
    [Key in keyof MakeOptionalRealOptionalHelper<Base>]: Base[Key];
};

/**
 * Patch type for an AutoEncoder subclass, including nested array/map patches.
 * PatchType cannot reliably infer subclass fields from AutoEncoder's generic patch method.
 */
export type AutoEncoderPatchType<T extends AutoEncoder> =
    AutoEncoder & (
        {
            [P in Exclude<Exclude<keyof T, 'id'>, keyof AutoEncoder>]: T[P] extends Function ? never : ConvertArrayToPatchableArray<T[P]>;
        } & (T extends NonScalarIdentifiable<infer Id> ? NonScalarIdentifiable<Id> : {})
    );

/**
 * Shorthand for an array patch of identifiable AutoEncoders.
 * For non-identifiable AutoEncoders this resolves to a replacement array instead.
 */
export type PatchableArrayAutoEncoder<P extends AutoEncoder> = P extends AutoEncoder & NonScalarIdentifiable<infer Id> ?
        (
            PatchableArray<Id, P, AutoEncoderPatchType<P> & NonScalarIdentifiable<Id>>
        )
    : P[];

export class PatchMap<K, V> extends Map<K, V> implements Cloneable {
    _isPatch = true;
    _isPatchMap = true;

    applyTo(obj: Map<any, any>) {
        if (isPatchMap(obj)) {
            // Combine instead of normal logic
            const clone = new PatchMap(obj);

            for (const [key, value] of this.entries()) {
                if (value === null) {
                    clone.set(key, null);
                    continue;
                }

                if (value === undefined) {
                    continue;
                }

                const original = obj.get(key);

                if (original === null) {
                    // Has been deleted higher up
                    if (isPatch(value)) {
                        continue;
                    }
                    clone.set(key, value);
                    continue;
                }

                if (original === undefined) {
                    clone.set(key, value);
                    continue;
                }

                clone.set(key, patchObject(original, value, { allowAutoDefaultValue: true }));
            }
            return clone;
        }

        const clone = new Map(obj);

        for (const [key, value] of this.entries()) {
            if (value === null) {
                clone.delete(key);
                continue;
            }

            if (value === undefined) {
                continue;
            }

            const original = obj.get(key);
            const patched = patchObject(original, value, { allowAutoDefaultValue: true });

            if (original === undefined && patched === undefined) {
                // Don't copy it: this is an empty patch to an item that does not exist
                continue;
            }
            clone.set(key, patched);
        }
        return clone;
    }

    clone<T extends this>(this: T): this {
        // Deep clone self
        const clone = new PatchMap<K, V>() as this;
        for (const [key, value] of this.entries()) {
            clone.set(key, cloneObject(value as any));
        }
        return clone;
    }
}

export function isPatchMap(obj: unknown): obj is PatchMap<any, any> {
    return typeof obj === 'object' && obj !== null && (obj as any)._isPatchMap;
}

export function isPatchableArray(obj: unknown): obj is PatchableArray<any, any, any> {
    return typeof obj === 'object' && obj !== null && (obj as any)._isPatchableArray;
}

export function isPatch(obj: unknown) {
    if (isAutoEncoder(obj)) {
        // Instance type could be different
        return obj.isPatch();
    }

    if (isPatchMap(obj)) {
        return true;
    }

    if (isPatchableArray(obj)) {
        return true;
    }

    return false;
}

export function isEmptyPatch(patch: unknown) {
    if (patch === undefined) {
        return true;
    }

    if (patch === null) {
        return false;
    }

    if (Array.isArray(patch)) {
        // Can override array
        return false;
    }

    if (isPatchableArray(patch)) {
        return patch.changes.length === 0;
    }

    if (isPatchMap(patch)) {
        return patch.size === 0;
    }

    if (patch instanceof Map) {
        return false;
    }

    if (typeof patch === 'object') {
        if (Object.keys(patch).length === 0) {
            return true;
        }
        return false;
    }

    return false;
}

/**
 * Applies a patch or replacement. Undefined keeps the original value; null clears it.
 * An absent nested AutoEncoder requires a default before an object patch can be applied.
 * Map patches can use automatic decoder defaults; missing array item IDs are not created.
 */
export function patchObject(obj: unknown, patch: unknown, options?: { getDefaultValue?: () => any | null; allowAutoDefaultValue?: boolean }): any {
    if (patch === undefined) {
        // When a property is set to undefined, we always ignore it, always. You can never set something to undefined.
        // Use null instead.
        return obj;
    }
    let empty = (obj === undefined || obj === null);

    if (empty) {
        if (isPatchableArray(patch)) {
            // Patch on optional array: ignore if empty patch, else fake empty array patch
            if (patch.changes.length === 0) {
                return obj;
            }
            const patched = patch.applyTo([]);
            if (patched.length === 0) {
            // Nothing changed, keep it undefined or null
                return obj;
            }

            return patched;
        }

        if (isPatchMap(patch)) {
            // Patch on optional array: ignore if empty patch, else fake empty array patch
            if (patch.size === 0) {
                return obj;
            }
            const patched = patch.applyTo(new Map());
            if (patched.size === 0) {
            // Nothing changed, keep it undefined or null
                return obj;
            }

            return patched;
        }

        // Only default if not a patchable array or patchable map
        if (options?.getDefaultValue !== undefined) {
            const d = options.getDefaultValue();
            if (d !== undefined && d !== null) {
                obj = d;
                empty = false;
            }
        }
    }

    if (isAutoEncoder(patch) && patch.isPut()) {
        // Instance type could be different
        return patch;
    }

    if (isPatchable(obj)) {
        if (patch === null) {
            return null;
        }

        return obj.patch(patch);
    }

    if (obj instanceof Map && isPatchMap(patch)) {
        return patch.applyTo(obj);
    }

    if (Array.isArray(obj)) {
        // Check if patch is a patchable array
        if (isPatchableArray(patch)) {
            return patch.applyTo(obj);
        }
        // What happens when an array field is set?
        // This can only happen when the autocoder is not identifieable, but
        // technically also in other cases if typescript doesn't check types
        // we just take over the new values and 'remove' all old elements
        return patch;
    }

    // Note: only when null, if undefined we allow
    if (empty && isAutoEncoder(patch) && patch.isPatch()) {
        // Check if we have a default where we can start.
        if (options?.allowAutoDefaultValue && patch.static.putType) {
            const def = (patch.static.putType).getDefaultValue();
            if (def) {
                return def.patch(patch);
            }
        }

        // Throw an error
        // You cannot patch null or undefined with a patchable object
        throw new SimpleError({
            code: 'cannot_patch_null',
            message: 'Cannot patch an object or property that is null or undefined and has no default value. You can only send a full object (a put) to replace it.',
        });
    }

    return patch;
}
