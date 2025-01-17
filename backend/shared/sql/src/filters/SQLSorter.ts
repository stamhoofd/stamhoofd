import { PlainObject } from '@simonbackx/simple-encoding';
import { SortDefinition, SortList } from '@stamhoofd/structures';

import { SQLOrderBy, SQLOrderByDirection } from '../SQLOrderBy';
import { SimpleError } from '@simonbackx/simple-errors';

export type SQLSortDefinition<T, B extends PlainObject | Date = PlainObject | Date> = SortDefinition<T, B> & {
    toSQL(direction: SQLOrderByDirection): SQLOrderBy;
};

export type SQLSortDefinitions<T = any> = Record<string, SQLSortDefinition<T>>;

export function compileToSQLSorter(sortBy: SortList, definitions: SQLSortDefinitions): SQLOrderBy {
    if (sortBy.length === 0) {
        throw new SimpleError({
            code: 'empty_sort',
            message: 'No sort passed',
        });
    }

    const sorters: SQLOrderBy[] = [];

    for (const s of sortBy) {
        const d = definitions[s.key];
        if (!d) {
            throw new Error('Unknown sort key ' + s.key);
        }

        sorters.push(d.toSQL(s.order));
    }

    if (sorters.length === 0) {
        throw new Error('No sortBy passed');
    }

    return SQLOrderBy.combine(sorters);
}
