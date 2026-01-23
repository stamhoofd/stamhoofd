import { baseSQLFilterCompilers, createColumnFilter, SQL, SQLFilterDefinitions, SQLValueType } from '@stamhoofd/sql';

export const invoicedBalanceItemCompilers: SQLFilterDefinitions = {
    ...baseSQLFilterCompilers,
    id: createColumnFilter({
        expression: SQL.column('id'),
        type: SQLValueType.String,
        nullable: false,
    }),
    name: createColumnFilter({
        expression: SQL.column('name'),
        type: SQLValueType.String,
        nullable: false,
    }),
    description: createColumnFilter({
        expression: SQL.column('description'),
        type: SQLValueType.String,
        nullable: false,
    }),
};
