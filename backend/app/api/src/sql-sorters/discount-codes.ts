import type { WebshopDiscountCode } from '@stamhoofd/models';
import type { SQLOrderByDirection, SQLSortDefinitions } from '@stamhoofd/sql';
import { SQL, SQLOrderBy } from '@stamhoofd/sql';
import { Formatter } from '@stamhoofd/utility';

export const discountCodeSorters: SQLSortDefinitions<WebshopDiscountCode> = {
    id: {
        getValue(code) {
            return code.id;
        },
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: SQL.column('id'),
                direction,
            });
        },
    },
    code: {
        getValue(code) {
            return code.code;
        },
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: SQL.column('code'),
                direction,
            });
        },
    },
    email: {
        getValue(code) {
            return code.email ?? '';
        },
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: SQL.column('email'),
                direction,
            });
        },
    },
    usageCount: {
        getValue(code) {
            return code.usageCount;
        },
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: SQL.column('usageCount'),
                direction,
            });
        },
    },
    createdAt: {
        getValue(code) {
            return Formatter.dateTimeIso(code.createdAt, 'UTC');
        },
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: SQL.column('createdAt'),
                direction,
            });
        },
    },
};
