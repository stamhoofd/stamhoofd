import type { PlainObject } from '@common/encoding';
import type { SortList } from './SortList.js';
import { SortItemDirection } from './SortList.js';

export type SortDefinition<T, B extends PlainObject | Date = PlainObject | Date> = {
    getValue(a: T): B;
};

/** Exact-key registry used for cursor filters; extracted values may be undefined. */
export type SortDefinitions<T> = Map<string, SortDefinition<T>>;

function sorterGetNextFilter<O>(lastObject: O, sortDefinitions: SortDefinitions<O>, list: SortList) {
    if (!lastObject) {
        return null;
    }

    const first = list[0];
    if (!first) {
        return null;
    }

    const definition = sortDefinitions.get(first.key);
    if (definition === undefined) {
        throw new Error('Unknown sort key ' + first.key);
    }

    const lastValue = definition.getValue(lastObject);
    const remaining = list.slice(1);

    const baseFilter = {
        // Either the object is plainly larger than this.
        [first.key]: {
            [first.order === SortItemDirection.ASC ? '$gt' : '$lt']: lastValue,
        },
    };

    if (remaining.length === 0) {
        return baseFilter;
    }

    const remainingFilter = sorterGetNextFilter(lastObject, sortDefinitions, remaining);
    if (!remainingFilter) {
        throw new Error('Unexpected remaining filter at ' + first.key);
    }

    return {
        $or: [
            baseFilter,
            {
                // OR, it is the same, but the following sorters are larger
                $and: [
                    {
                        [first.key]: lastValue,
                    },
                    remainingFilter,
                ],
            },
        ],
    };
}

export function getSortFilter<O>(lastObject: O, sortDefinitions: SortDefinitions<O>, list: SortList) {
    if (!lastObject) {
        return null;
    }

    // We always add id
    return sorterGetNextFilter(lastObject, sortDefinitions, list);
}
