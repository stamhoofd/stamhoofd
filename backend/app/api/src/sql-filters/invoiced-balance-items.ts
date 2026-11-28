import type { SQLFilterDefinitions } from '@stamhoofd/node-sql';
import { baseSQLFilterCompilers, createColumnFilter, SQL, SQLValueType } from '@stamhoofd/node-sql';

export const invoicedBalanceItemCompilers: SQLFilterDefinitions = new Map([
    ...baseSQLFilterCompilers,
    [
        'id',
        createColumnFilter({
            expression: SQL.column('id'),
            type: SQLValueType.String,
            nullable: false,
        }),
    ],
    [
        'balanceItemId',
        createColumnFilter({
            expression: SQL.column('balanceItemId'),
            type: SQLValueType.String,
            nullable: false,
        }),
    ],
    [
        'name',
        createColumnFilter({
            expression: SQL.column('name'),
            type: SQLValueType.String,
            nullable: false,
        }),
    ],
    [
        'description',
        createColumnFilter({
            expression: SQL.column('description'),
            type: SQLValueType.String,
            nullable: false,
        }),
    ],
]);
