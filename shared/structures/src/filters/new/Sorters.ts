import { PlainObject } from "@simonbackx/simple-encoding";
import { SortItemDirection, SortList } from "./SortList";

export type SortDefinition<T, B extends PlainObject = PlainObject> = {
    getValue(a: T): B
};

export type SortDefinitions<T> = Record<string, SortDefinition<T>>

function sorterGetNextFilter<O>(lastObject: O, sortDefinitions: SortDefinitions<O>, list: SortList) {
    if (!lastObject) {
        return null;
    }

    const first = list[0];
    if (!first) {
        return null;
    }
    
    const definition = sortDefinitions[first.key];
    if (!definition) {
        throw new Error('Unknown sort key ' + first.key)
    }

    const lastValue = definition.getValue(lastObject)
    const remaining = list.slice(1)

    const baseFilter = {
        // Either the object is plainly larger than this. 
        [first.key]: {
            [first.order === 'ASC' ? '$gt' : '$lt']: lastValue
        }
    };

    if (remaining.length === 0) {
        return baseFilter
    }

    const remainingFilter = sorterGetNextFilter(lastObject, sortDefinitions, remaining);
    if (!remainingFilter) {
        throw new Error('Unexpected remaining filter at ' + first.key)
    }

    return {
        $or: [
            baseFilter,
            {
                // OR, it is the same, but the following sorters are larger
                $and: [
                    {
                        [first.key]: lastValue
                    },
                    remainingFilter
                ]
            }
        ]
    };
}

export function getSortFilter<O>(lastObject: O, sortDefinitions: SortDefinitions<O>, list: SortList) {
    if (!lastObject) {
        return null;
    }

    // We always add id
    return sorterGetNextFilter(lastObject, sortDefinitions, list)
}
