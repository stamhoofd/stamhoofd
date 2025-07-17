import { baseModernSQLFilterCompilers, createColumnFilter, SQL, SQLModernFilterDefinitions, SQLValueType } from '@stamhoofd/sql';

export const organizationRegistrationPeriodFilterCompilers: SQLModernFilterDefinitions = {
    ...baseModernSQLFilterCompilers,
    id: createColumnFilter({
        expression: SQL.column('id'),
        type: SQLValueType.String,
        nullable: false,
    }),
    organizationId: createColumnFilter({
        expression: SQL.column('organizationId'),
        type: SQLValueType.String,
        nullable: false,
    }),
    periodId: createColumnFilter({
        expression: SQL.column('periodId'),
        type: SQLValueType.String,
        nullable: false,
    }),
};
