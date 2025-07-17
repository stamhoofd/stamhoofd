import { baseModernSQLFilterCompilers, createColumnFilter, SQL, SQLModernFilterDefinitions, SQLValueType } from '@stamhoofd/sql';

export const auditLogFilterCompilers: SQLModernFilterDefinitions = {
    ...baseModernSQLFilterCompilers,
    id: createColumnFilter({
        expression: SQL.column('id'),
        type: SQLValueType.String,
        nullable: false,
    }),
    organizationId: createColumnFilter({
        expression: SQL.column('organizationId'),
        type: SQLValueType.String,
        nullable: true,
    }),
    type: createColumnFilter({
        expression: SQL.column('type'),
        type: SQLValueType.String,
        nullable: false,
    }),
    objectId: createColumnFilter({
        expression: SQL.column('objectId'),
        type: SQLValueType.String,
        nullable: true,
    }),
    createdAt: createColumnFilter({
        expression: SQL.column('createdAt'),
        type: SQLValueType.Datetime,
        nullable: false,
    }),
};
