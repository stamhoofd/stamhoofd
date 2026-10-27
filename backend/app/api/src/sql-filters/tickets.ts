import type { SQLFilterDefinitions } from '@stamhoofd/sql';
import { baseSQLFilterCompilers, createColumnFilter, SQL, SQLValueType } from '@stamhoofd/sql';

export const ticketFilterCompilers: SQLFilterDefinitions = new Map([
    ...baseSQLFilterCompilers,
    ['organizationId', createColumnFilter({
        expression: SQL.column('organizationId'),
        type: SQLValueType.String,
        nullable: false,
    })],
    ['updatedAt', createColumnFilter({
        expression: SQL.column('updatedAt'),
        type: SQLValueType.Datetime,
        nullable: false,
    })],
    ['webshopId', createColumnFilter({
        expression: SQL.column('webshopId'),
        type: SQLValueType.String,
        nullable: false,
    })],
    ['id', createColumnFilter({
        expression: SQL.column('id'),
        type: SQLValueType.String,
        nullable: false,
    })],
    // Only exact matches: comparison operators would allow guessing a secret character by character
    ['secret', createColumnFilter({
        expression: SQL.column('secret'),
        type: SQLValueType.String,
        nullable: false,
    }, new Map([
        ['$eq', baseSQLFilterCompilers.get('$eq')!],
        ['$in', baseSQLFilterCompilers.get('$in')!],
    ]))],
    ['createdAt', createColumnFilter({
        expression: SQL.column('createdAt'),
        type: SQLValueType.Datetime,
        nullable: false,
    })],
]);
