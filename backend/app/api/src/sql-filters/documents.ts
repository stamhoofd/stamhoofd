import { baseSQLFilterCompilers, createColumnFilter, SQL, SQLFilterDefinitions, SQLValueType } from '@stamhoofd/sql';

export const documentFilterCompilers: SQLFilterDefinitions = {
    ...baseSQLFilterCompilers,
    id: createColumnFilter({
        expression: SQL.column('id'),
        type: SQLValueType.String,
        nullable: false,
    }),
    description: createColumnFilter({
        expression: SQL.jsonExtract(SQL.column('data'), '$.value.description'),
        type: SQLValueType.JSONString,
        nullable: false,
    }),
    organizationId: createColumnFilter({
        expression: SQL.column('organizationId'),
        type: SQLValueType.String,
        nullable: false,
    }),
    templateId: createColumnFilter({
        expression: SQL.column('templateId'),
        type: SQLValueType.String,
        nullable: false,
    }),
    memberId: createColumnFilter({
        expression: SQL.column('memberId'),
        type: SQLValueType.String,
        nullable: true,
    }),
    updatedAt: createColumnFilter({
        expression: SQL.column('updatedAt'),
        type: SQLValueType.Datetime,
        nullable: false,
    }),
    createdAt: createColumnFilter({
        expression: SQL.column('createdAt'),
        type: SQLValueType.Datetime,
        nullable: false,
    }),
    number: createColumnFilter({
        expression: SQL.column('number'),
        type: SQLValueType.Number,
        nullable: true,
    }),
    status: createColumnFilter({
        expression: SQL.column('status'),
        type: SQLValueType.String,
        nullable: false,
    }),
};
