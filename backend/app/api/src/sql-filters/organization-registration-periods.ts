import type { SQLFilterDefinitions } from '@stamhoofd/sql';
import { baseSQLFilterCompilers, createColumnFilter, SQL, SQLValueType } from '@stamhoofd/sql';

export const organizationRegistrationPeriodFilterCompilers: SQLFilterDefinitions = new Map([
    ...baseSQLFilterCompilers,
    ['id', createColumnFilter({
        expression: SQL.column('id'),
        type: SQLValueType.String,
        nullable: false,
    })],
    ['organizationId', createColumnFilter({
        expression: SQL.column('organizationId'),
        type: SQLValueType.String,
        nullable: false,
    })],
    ['periodId', createColumnFilter({
        expression: SQL.column('periodId'),
        type: SQLValueType.String,
        nullable: false,
    })],
]);
