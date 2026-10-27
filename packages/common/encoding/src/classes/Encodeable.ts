import { EncodeContext, EncodeMedium } from './EncodeContext.js';

export type PlainObject = string | number | { [key: string]: PlainObject } | boolean | PlainObject[] | undefined | null;

/** Converts an instance to plain data suitable for JSON serialization. */
export interface Encodeable {
    /** Pass the same context to nested encoders; version/medium can affect the format. */
    encode(context: EncodeContext): PlainObject;
}

export interface TypedEncodeable<T extends PlainObject> extends Encodeable {
    encode(context: EncodeContext): T;
}

export function isEncodeable(object: any): object is Encodeable {
    if (typeof object !== 'object' || object === null) {
        return false;
    }
    return typeof object.encode === 'function';
}

export type EncodableObject = Encodeable | EncodableObject[] | Map<EncodableObject & keyof any, EncodableObject> | PlainObject;

const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * Use this method to encode an object (might be an encodeable implementation) into a decodable structure
 */
export function encodeObject(obj: unknown, context: EncodeContext): PlainObject {
    // Go from most common types to less common types. This increases performance a lot!
    const t = typeof obj;
    if (t === 'string' || t === 'number' || t === 'boolean' || obj === null || obj === undefined) {
        return obj as PlainObject;
    }

    if (t === 'object') {
        if (typeof (obj as any).encode === 'function') {
            return (obj as any).encode(context);
        }
        if ((obj as any).length !== undefined && Array.isArray(obj)) {
            const len = obj.length;
            const result: PlainObject[] = new Array(obj.length);
            for (let i = 0; i < len; i++) {
                result[i] = encodeObject(obj[i], context);
            }
            return result;
        }

        if ((obj as any).size !== undefined && obj instanceof Map) {
            const encodedObj: any = {};

            if (context.medium === EncodeMedium.Database || isDevelopment) {
                // Only sort keys in database to avoid chaining data
                const keys = [...obj.keys()];

                if (keys.length !== 0) {
                    const firstKey = keys[0];
                    const firstType = typeof firstKey;

                    // check type of keys
                    if (firstType !== 'string' && firstType !== 'number') {
                        throw new Error(`Map keys must be strings or numbers. Got ${firstType}`);
                    }

                    for (const key of keys) {
                        if (typeof key !== firstType) {
                            throw new Error(`Map keys must be of the same type. Got ${firstType} and ${typeof key}`);
                        }
                    }

                    // sort keys
                    if (firstType === 'number') {
                        keys.sort((a, b) => a - b);
                    }
                    else {
                        keys.sort((a, b) => a.localeCompare(b));
                    }

                    for (const key of keys) {
                        const value = obj.get(key);
                        encodedObj[key] = encodeObject(value, context);
                    }
                }
            }
            else {
                for (const [key, value] of obj) {
                    const k = encodeObject(key, context);
                    if (typeof k !== 'string' && typeof k !== 'number') {
                        throw new Error(`Map keys must be strings or numbers. Got ${k}`);
                    }
                    encodedObj[k] = encodeObject(value, context);
                }
            }

            if ((obj as any)._isPatch) {
                return {
                    _isPatch: true,
                    changes: encodedObj,
                };
            }
            return encodedObj;
        }

        if (context.medium === EncodeMedium.Database || isDevelopment) {
            // Sort keys
            const keys = Object.keys(obj).sort(sortObjectKeysForEncoding);
            const encodedObj: any = {};
            for (const key of keys) {
                encodedObj[key] = encodeObject((obj as any)[key], context);
            }
            return encodedObj;
        }

        const encodedObj: any = {};
        for (const key in obj) {
            encodedObj[key] = encodeObject((obj as any)[key], context);
        }
        return encodedObj;
    }

    if (t === 'symbol') {
        const key = Symbol.keyFor(obj as symbol);

        if (key) {
            return {
                $symbol: key,
            };
        }
    }

    // Failed to decode
    return obj as PlainObject;
}

export function sortObjectKeysForEncoding(a: string, b: string) {
    // Always have a fixed order for certain keys, and follow with alphabetical order
    // id, name, description, ...remaining
    if (a === b) {
        return 0;
    }

    if (a === 'id') {
        return -1;
    }

    if (b === 'id') {
        return 1;
    }

    if (a === 'name') {
        return -1;
    }

    if (b === 'name') {
        return 1;
    }

    if (a === 'description') {
        return -1;
    }

    if (b === 'description') {
        return 1;
    }

    return a.localeCompare(b);
}
