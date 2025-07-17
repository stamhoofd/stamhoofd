import { baseModernSQLFilterCompilers, createColumnFilter, SQL, SQLModernFilterDefinitions, SQLModernValueType } from '@stamhoofd/sql';

export const auditLogFilterCompilers: SQLModernFilterDefinitions = {
    ...baseModernSQLFilterCompilers,
    id: createColumnFilter({
        expression: SQL.column('id'),
        type: SQLModernValueType.String,
        nullable: false,
    }),
    organizationId: createColumnFilter({
        expression: SQL.column('organizationId'),
        type: SQLModernValueType.String,
        nullable: true,
    }),
    type: createColumnFilter({
        expression: SQL.column('type'),
        type: SQLModernValueType.String,
        nullable: false,
    }),
    objectId: createColumnFilter({
        expression: SQL.column('objectId'),
        type: SQLModernValueType.String,
        nullable: true,
    }),
    createdAt: createColumnFilter({
        expression: SQL.column('createdAt'),
        type: SQLModernValueType.Datetime,
        nullable: false,
    }),
};
