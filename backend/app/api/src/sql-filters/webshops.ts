import type { SQLFilterDefinitions } from '@stamhoofd/sql';
import { baseSQLFilterCompilers, createColumnFilter, createJoinedRelationFilter, SQL, SQLValueType } from '@stamhoofd/sql';
import { organizationFilterCompilers } from './organizations.js';

export const organizationJoin = SQL.join('organizations').where(SQL.column('organizations', 'id'), SQL.column('webshops', 'organizationId'));

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
    status: createColumnFilter({
        expression: SQL.jsonExtract(SQL.column('webshops', 'meta'), '$.value.status'),
        type: SQLValueType.JSONString,
        nullable: false,
    }),
    organization: createJoinedRelationFilter(
        organizationJoin,
        organizationFilterCompilers,
    ),
};
