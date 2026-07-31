import type { BalanceItemPayment } from '@stamhoofd/models';
import type { SQLOrderByDirection, SQLSortDefinitions } from '@stamhoofd/sql';
import { SQL, SQLOrderBy } from '@stamhoofd/sql';
import { Formatter } from '@stamhoofd/utility';

export const balanceItemPaymentSorters: SQLSortDefinitions<BalanceItemPayment> = {
    // WARNING! TEST NEW SORTERS THOROUGHLY! See balanceItemSorters for why sorting on anything that is
    // not 1:1 with a column breaks pagination.

    id: {
        getValue(a) {
            return a.id;
        },
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: SQL.column('balance_item_payments', 'id'),
                direction,
            });
        },
    },
    createdAt: {
        getValue(a) {
            return Formatter.dateTimeIso(a.createdAt, 'UTC');
        },
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: SQL.column('balance_item_payments', 'createdAt'),
                direction,
            });
        },
    },
};
