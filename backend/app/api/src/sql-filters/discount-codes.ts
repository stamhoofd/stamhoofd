import type { SQLFilterDefinitions } from '@stamhoofd/sql';
import { baseSQLFilterCompilers, createColumnFilter, SQL, SQLValueType } from '@stamhoofd/sql';

export const discountCodeFilterCompilers: SQLFilterDefinitions = {
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
    webshopId: createColumnFilter({
        expression: SQL.column('webshopId'),
        type: SQLValueType.String,
        nullable: false,
    }),
    code: createColumnFilter({
        expression: SQL.column('code'),
        type: SQLValueType.String,
        nullable: false,
    }),
    description: createColumnFilter({
        expression: SQL.column('description'),
        type: SQLValueType.String,
        nullable: false,
    }),
    email: createColumnFilter({
        expression: SQL.column('email'),
        type: SQLValueType.String,
        nullable: true,
    }),
    usageCount: createColumnFilter({
        expression: SQL.column('usageCount'),
        type: SQLValueType.Number,
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
};
