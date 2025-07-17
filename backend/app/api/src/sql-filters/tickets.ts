import { baseModernSQLFilterCompilers, createColumnFilter, SQL, SQLModernFilterDefinitions, SQLModernValueType } from '@stamhoofd/sql';

export const ticketFilterCompilers: SQLModernFilterDefinitions = {
    ...baseModernSQLFilterCompilers,
    organizationId: createColumnFilter({
        expression: SQL.column('organizationId'),
        type: SQLModernValueType.String,
        nullable: false,
    }),
    updatedAt: createColumnFilter({
        expression: SQL.column('updatedAt'),
        type: SQLModernValueType.Datetime,
        nullable: false,
    }),
    webshopId: createColumnFilter({
        expression: SQL.column('webshopId'),
        type: SQLModernValueType.String,
        nullable: false,
    }),
    id: createColumnFilter({
        expression: SQL.column('id'),
        type: SQLModernValueType.String,
        nullable: false,
    }),
    createdAt: createColumnFilter({
        expression: SQL.column('createdAt'),
        type: SQLModernValueType.Datetime,
        nullable: false,
    }),
};
