import type { Webshop } from '@stamhoofd/models';
import type { SQLOrderByDirection, SQLSortDefinitions } from '@stamhoofd/sql';
import { SQL, SQLOrderBy } from '@stamhoofd/sql';

export const webshopSorters: SQLSortDefinitions<Webshop> = {
    id: {
        getValue(a) {
            return a.id;
        },
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: SQL.column('id'),
                direction,
            });
        },
    },
    name: {
        getValue(a) {
            return a.meta.name;
        },
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: SQL.jsonValue(SQL.column('meta'), '$.value.name', 'CHAR'),
                direction,
            });
        },
    },
};
