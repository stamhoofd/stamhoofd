import { PlainObject } from "@simonbackx/simple-encoding";
import { Sorter } from "@stamhoofd/utility";

import { MemberSummary } from "../../admin/MemberSummary";
import { SortDefinition } from "./Sorters";
import { SortList } from "./SortList";

export type InMemorySorter<T> = (a: T, b: T) => number;
export type InMemorySortDefinition<T, B extends PlainObject = PlainObject> = SortDefinition<T, B> & {
    sort: InMemorySorter<T>
};

export type InMemorySortDefinitions<T> = Record<string, InMemorySortDefinition<T>>


export function compileToInMemorySorter<T>(sortBy: SortList, definitions: InMemorySortDefinitions<T>): InMemorySorter<T> {
    const sorters: InMemorySorter<T>[] = [];
    for (const s of sortBy) {
        const d = definitions[s.key];
        if (!d) {
            throw new Error('Unknown sort key ' + s.key)
        }

        if (s.order === 'DESC') {
            sorters.push((a, b) => {
                return - d.sort(a, b)
            });
        } else {
            sorters.push(d.sort);
        }
    }

    if (sorters.length === 0) {
        throw new Error('No sortBy passed')
    }

    return (a , b) => {
        return Sorter.stack(...sorters.map(s => s(a, b)))
    }
}

export const memberInMemorySorters: InMemorySortDefinitions<MemberSummary> = {
    'id': {
        getValue(a) {
            return a.id
        },
        sort: (a, b) => {
            return Sorter.byStringValue(a.id, b.id);
        }
    },
    'name': {
        getValue(a) {
            return a.name
        },
        sort: (a, b) => {
            return Sorter.byStringValue(a.name, b.name);
        }
    },
    'birthDay': {
        getValue(a) {
            return a.birthDay?.getTime() ?? 0
        },
        sort: (a, b) => {
            return Sorter.byNumberValue(b.birthDay?.getTime() ?? 0, a.birthDay?.getTime() ?? 0);
        }
    },
    'organizationName': {
        getValue(a) {
            return a.organizationName
        },
        sort: (a, b) => {
            return Sorter.byStringValue(b.organizationName, a.organizationName);
        }
    }
}