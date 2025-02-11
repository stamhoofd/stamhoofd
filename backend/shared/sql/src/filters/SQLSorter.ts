import { PlainObject } from '@simonbackx/simple-encoding';
import { SortDefinition, SortList } from '@stamhoofd/structures';

import { SQLOrderBy, SQLOrderByDirection } from '../SQLOrderBy';
import { SimpleError } from '@simonbackx/simple-errors';
import { SQLSelect } from '../SQLSelect';
import { SQLJoin } from '../SQLJoin';
import { SQLExpression } from '../SQLExpression';

export type SQLSortDefinition<T, B extends PlainObject | Date = PlainObject | Date> = SortDefinition<T, B> & {
    toSQL(direction: SQLOrderByDirection): SQLOrderBy;
    join?: SQLJoin;
    select?: (SQLExpression | string)[];
};

export type SQLSortDefinitions<T = any> = Record<string, SQLSortDefinition<T>>;

export function applySQLSorter(selectQuery: SQLSelect<any>, sortBy: SortList, definitions: SQLSortDefinitions) {
    if (sortBy.length === 0) {
        throw new SimpleError({
            code: 'empty_sort',
            message: 'No sort passed',
        });
    }

    for (const s of sortBy) {
        const d = definitions[s.key];
        if (!d) {
            throw new Error('Unknown sort key ' + s.key);
        }

        selectQuery.orderBy(d.toSQL(s.order));

        if (d.join) {
            // Check if no overlap in alias/table (otherwise we'll get issues)
            const name = d.join.table.getSQL({ defaultNamespace: 'default' });

            for (const j of selectQuery._joins) {
                if (j.table.getSQL({ defaultNamespace: 'default' }) === name) {
                    throw new SimpleError({
                        code: 'sorter_join_overlap',
                        message: 'This combination of sorters is not possible',
                        human: 'Deze combinatie van sorteringen is niet mogelijk',
                    });
                }
            }

            selectQuery.join(d.join);
        }

        if (d.select) {
            selectQuery.select(...d.select);
        }
    }
}
