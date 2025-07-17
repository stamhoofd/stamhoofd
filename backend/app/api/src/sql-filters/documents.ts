import { baseModernSQLFilterCompilers, createColumnFilter, SQL, SQLModernFilterDefinitions, SQLModernValueType } from '@stamhoofd/sql';

export const documentFilterCompilers: SQLModernFilterDefinitions = {
    ...baseModernSQLFilterCompilers,
    id: createColumnFilter({
        expression: SQL.column('id'),
        type: SQLModernValueType.String,
        nullable: false,
    }),
    description: createColumnFilter({
        expression: SQL.jsonValue(SQL.column('data'), '$.value.description'),
        type: SQLModernValueType.JSONString,
        nullable: false,
    }),
    organizationId: createColumnFilter({
        expression: SQL.column('organizationId'),
        type: SQLModernValueType.String,
        nullable: false,
    }),
    templateId: createColumnFilter({
        expression: SQL.column('templateId'),
        type: SQLModernValueType.String,
        nullable: false,
    }),
    memberId: createColumnFilter({
        expression: SQL.column('memberId'),
        type: SQLModernValueType.String,
        nullable: true,
    }),
    updatedAt: createColumnFilter({
        expression: SQL.column('updatedAt'),
        type: SQLModernValueType.Datetime,
        nullable: false,
    }),
    createdAt: createColumnFilter({
        expression: SQL.column('createdAt'),
        type: SQLModernValueType.Datetime,
        nullable: false,
    }),
    number: createColumnFilter({
        expression: SQL.column('number'),
        type: SQLModernValueType.Number,
        nullable: true,
    }),
    status: createColumnFilter({
        expression: SQL.column('status'),
        type: SQLModernValueType.String,
        nullable: false,
    }),
};
