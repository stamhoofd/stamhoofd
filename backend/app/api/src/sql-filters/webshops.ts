import type { SQLFilterDefinitions } from '@stamhoofd/sql';
import { baseSQLFilterCompilers, createColumnFilter, SQL, SQLValueType } from '@stamhoofd/sql';

export const webshopFilterCompilers: SQLFilterDefinitions = {
    ...baseSQLFilterCompilers,
    id: createColumnFilter({
        expression: SQL.column('webshops', 'id'),
        type: SQLValueType.String,
        nullable: false,
    }),
    organizationId: createColumnFilter({
        expression: SQL.column('webshops', 'organizationId'),
        type: SQLValueType.String,
        nullable: false,
    }),
    name: createColumnFilter({
        expression: SQL.jsonExtract(SQL.column('webshops', 'meta'), '$.value.name'),
        type: SQLValueType.JSONString,
        nullable: false,
    }),
};
