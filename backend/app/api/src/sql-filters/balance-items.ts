import { baseSQLFilterCompilers, createColumnFilter, SQL, SQLFilterDefinitions, SQLValueType } from '@stamhoofd/sql';

/**
 * Defines how to filter balance items in the database from StamhoofdFilter objects
 */
export const balanceItemFilterCompilers: SQLFilterDefinitions = {
    ...baseSQLFilterCompilers,
    id: createColumnFilter({
        expression: SQL.column('id'),
        type: SQLValueType.String,
        nullable: false,
    }),
    organizationId: createColumnFilter({
        expression: SQL.column('organizationId'),
        type: SQLValueType.String,
        nullable: false,
    }),
    type: createColumnFilter({
        expression: SQL.column('type'),
        type: SQLValueType.String,
        nullable: false,
    }),
    status: createColumnFilter({
        expression: SQL.column('status'),
        type: SQLValueType.String,
        nullable: false,
    }),
    createdAt: createColumnFilter({
        expression: SQL.column('createdAt'),
        type: SQLValueType.Datetime,
        nullable: false,
    }),
    updatedAt: createColumnFilter({
        expression: SQL.column('updatedAt'),
        type: SQLValueType.Datetime,
        nullable: false,
    }),

    description: createColumnFilter({
        expression: SQL.column('description'),
        type: SQLValueType.String,
        nullable: false,
    }),

    priceWithVAT: createColumnFilter({
        expression: SQL.column('priceTotal'),
        type: SQLValueType.Number,
        nullable: false,
    }),

    priceOpen: createColumnFilter({
        expression: SQL.column('priceOpen'),
        type: SQLValueType.Number,
        nullable: false,
    }),
};
