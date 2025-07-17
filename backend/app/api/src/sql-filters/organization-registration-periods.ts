import { baseModernSQLFilterCompilers, createColumnFilter, SQL, SQLModernFilterDefinitions, SQLModernValueType } from '@stamhoofd/sql';

export const organizationRegistrationPeriodFilterCompilers: SQLModernFilterDefinitions = {
    ...baseModernSQLFilterCompilers,
    id: createColumnFilter({
        expression: SQL.column('id'),
        type: SQLModernValueType.String,
        nullable: false,
    }),
    organizationId: createColumnFilter({
        expression: SQL.column('organizationId'),
        type: SQLModernValueType.String,
        nullable: false,
    }),
    periodId: createColumnFilter({
        expression: SQL.column('periodId'),
        type: SQLModernValueType.String,
        nullable: false,
    }),
};
