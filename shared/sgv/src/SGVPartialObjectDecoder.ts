import type { Data, Decoder } from '@common/encoding';
import { SimpleError } from '@common/errors';

function copyObject(value: object): Record<string, unknown> {
    const result = Object.create(null) as Record<string, unknown>;
    for (const [key, item] of Object.entries(value)) {
        result[key] = copyValue(item);
    }
    return result;
}

function copyValue(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map((item) => copyValue(item));
    }
    return value !== null && typeof value === 'object' ? copyObject(value) : value;
}

/**
 * SGV partial payloads retain unknown keys and values for forward compatibility.
 * Only the container is validated; response-only required fields are not required in patches.
 * JSON objects are copied recursively without prototypes; arrays and scalar values retain their shape.
 * Literal special keys remain data, so consumers must not merge these into ordinary objects unsafely.
 */
export class SGVPartialObjectDecoder<T extends object> implements Decoder<T> {
    decode(data: Data): T {
        const value: unknown = data.value;
        if (typeof value !== 'object' || value === null) {
            throw new SimpleError({
                code: 'invalid_field',
                message: `Expected an object at ${data.currentField}`,
                field: data.currentField,
            });
        }
        return copyObject(value) as T;
    }
}
