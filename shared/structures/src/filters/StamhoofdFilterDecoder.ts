import type { Data, EncodeContext, PlainObject } from '@common/encoding';
import { DateDecoder } from '@common/encoding';
import { SimpleError } from '@common/errors';

import type {
    StamhoofdCompareValue,
    StamhoofdFilter,
} from '@stamhoofd/filters/StamhoofdFilterTypes';

export class StamhoofdFilterJSONDecoder {
    static encode(filter: StamhoofdFilter, context: EncodeContext): string {
        return JSON.stringify(StamhoofdFilterDecoder.encode(filter, context));
    }

    static decode(data: Data): StamhoofdFilter {
        const str = data.string;
        try {
            const decoded = JSON.parse(str);
            return StamhoofdFilterDecoder.decode(
                data.clone({ data: decoded, field: data.currentField, context: data.context }),
            );
        } catch (e) {
            throw new SimpleError({
                code: 'invalid_field',
                message: `Expected JSON at ${data.currentField}`,
                field: data.currentField,
            });
        }
    }
}

export class StamhoofdFilterDecoder {
    static encode(
        filter: StamhoofdFilter<StamhoofdCompareValue>,
        context: EncodeContext,
    ): PlainObject {
        // We need to convert all Date objects to something recornizable so we can decode them as Dates too
        // We'll use magic objects for this: { $: '$date', value: unixtimeinms }
        if (filter instanceof Date) {
            return { $: '$date', value: filter.encode(context) };
        }

        if (filter === null) {
            return null;
        }

        if (Array.isArray(filter)) {
            return filter.map((f) => this.encode(f, context));
        }

        if (typeof filter === 'object') {
            // Loop and replace all keys
            const c = {} as Record<string, PlainObject>;
            for (const [key, value] of Object.entries(filter)) {
                Object.defineProperty(c, key, {
                    value: this.encode(value, context),
                    enumerable: true,
                    configurable: true,
                    writable: true,
                });
            }
            return c;
        }

        return filter;
    }

    static decode(data: Data): StamhoofdFilter {
        const value: unknown = data.value;

        if (value === null) {
            return null;
        }

        if (Array.isArray(value)) {
            return value.map((v, index) =>
                this.decode(
                    data.clone({
                        data: v,
                        field: data.addToCurrentField(index),
                        context: data.context,
                    }),
                ),
            );
        }

        if (typeof value === 'object') {
            // Check if it's a date
            if (
                '$' in value &&
                Object.hasOwn(value, '$') &&
                value.$ === '$date' &&
                'value' in value &&
                Object.hasOwn(value, 'value')
            ) {
                return DateDecoder.decode(
                    data.clone({
                        data: value.value,
                        field: data.addToCurrentField('value'),
                        context: data.context,
                    }),
                );
            }

            // Loop and replace all keys
            const c = {} as Record<string, StamhoofdFilter>;
            for (const [key, v] of Object.entries(value)) {
                Object.defineProperty(c, key, {
                    value: this.decode(
                        data.clone({
                            data: v,
                            field: data.addToCurrentField(key),
                            context: data.context,
                        }),
                    ),
                    enumerable: true,
                    configurable: true,
                    writable: true,
                });
            }
            return c;
        }

        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            return value;
        }

        throw new SimpleError({
            code: 'invalid_field',
            message: `Invalid filter at ${data.currentField}`,
            field: data.currentField,
        });
    }
}
