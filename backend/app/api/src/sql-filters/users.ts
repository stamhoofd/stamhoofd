import type { SQLFilterDefinitions } from '@stamhoofd/node-sql';
import { baseSQLFilterCompilers, createColumnFilter, SQL, SQLValueType } from '@stamhoofd/node-sql';

export const userFilterCompilers: SQLFilterDefinitions = new Map([
    ...baseSQLFilterCompilers,
    [
        'verified',
        createColumnFilter({
            expression: SQL.column('verified'),
            type: SQLValueType.Boolean,
            nullable: false,
        }),
    ],
]);
