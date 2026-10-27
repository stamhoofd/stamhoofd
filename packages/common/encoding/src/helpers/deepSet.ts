import { getOptionalId, hasId } from '../classes/Identifiable.js';
import { deepSetArray } from './deepSetArray.js';
import { deepSetMap } from './deepSetMap.js';

/**
 * A plain object is a dictionary literal ({ ... }) - not a class instance (AutoEncoder, Date, Map, ...).
 * Its set of keys is data, so unlike a class instance it can legitimately gain and lose keys.
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
    if (value === null || typeof value !== 'object') {
        return false;
    }
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
}

export function deepSet(base: unknown, object: unknown, options?: { replaceOnIdChange?: boolean }): unknown {
    if (object === base) {
        // Nothing to do (waste of resources)
        return base;
    }

    if (base === null || base === undefined || typeof base === 'string' || typeof base === 'number' || typeof base === 'boolean') {
        // Cannot update reference
        return object;
    }

    if (base instanceof Date) {
        if (object instanceof Date) {
            base.setTime(object.getTime());
            return base;
        }
        // Override
        return object;
    }

    if (object !== null && base !== null && typeof object === 'object' && typeof base === 'object') {
        if (Array.isArray(base)) {
            if (Array.isArray(object)) {
                return deepSetArray(base, object);
            }
            // Override
            return object;
        }

        if (base instanceof Map) {
            if (object instanceof Map) {
                return deepSetMap(base, object);
            }

            // Override
            return object;
        }

        // Check if base has an id
        // It is possible that the id of a deeper object has changed, that should not mean that the
        // object should change everywhere, so we don't set.
        // This is only required when supportReplace, since then we are updating more deeply already
        // E.g. address objects in Stamhoofd have an id getter where this causes issues.
        // E.g. you change a group property of an event, that should not mean the old group should be swapped with the new group
        if (options?.replaceOnIdChange && hasId(base)) {
            if (getOptionalId(base) !== getOptionalId(object)) {
                // Skip copy if not the same: replace with object
                return object;
            }
        }

        for (const key in object) {
            if (Object.hasOwn(object, key)) {
                const descriptor = Object.getOwnPropertyDescriptor(object, key);
                if (!(
                    descriptor !== undefined
                    && typeof descriptor.get === 'undefined' // exclude getters
                    && typeof descriptor.set === 'undefined' // exclude setters
                    && typeof object[key] !== 'function' // exclude methods
                )) {
                    continue;
                }

                const value = object[key];
                const baseValue = base[key];

                // Precent recursive updates
                object[key] = baseValue;
                const setValue = deepSet(baseValue, value, { replaceOnIdChange: true });
                if (setValue !== baseValue) {
                    // Reference was not updated, set instead
                    base[key] = setValue;
                    object[key] = setValue;
                }
            }
        }

        // The loop above only ever copies over the keys that exist on `object`. For a class instance
        // (AutoEncoder, ...) that is enough, since base and object share the same fixed set of fields.
        // But a plain-object dictionary (e.g. a filter like { $and: [...] }) has a key set that is
        // data: when it is simplified - e.g. to a bare { age: {...} } condition once the `$and` wrapper
        // is dropped - keys that are only on `base` would otherwise survive the merge. So for two plain
        // objects, sync the key set by removing base-only keys, leaving base with exactly object's keys.
        // Getters/setters/methods are left untouched (same exclusion as the copy loop above).
        if (isPlainObject(base) && isPlainObject(object)) {
            for (const key in base) {
                if (Object.hasOwn(base, key) && !Object.hasOwn(object, key)) {
                    const descriptor = Object.getOwnPropertyDescriptor(base, key);
                    if (
                        descriptor !== undefined
                        && typeof descriptor.get === 'undefined' // exclude getters
                        && typeof descriptor.set === 'undefined' // exclude setters
                        && typeof base[key] !== 'function' // exclude methods
                    ) {
                        delete base[key];
                    }
                }
            }
        }

        return base;
    }

    // Override
    return object;
}
