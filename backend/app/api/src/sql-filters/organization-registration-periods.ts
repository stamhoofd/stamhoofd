import { SQLFilterDefinitions, baseSQLFilterCompilers, createSQLColumnFilterCompiler } from '@stamhoofd/sql';

export const organizationRegistrationPeriodFilterCompilers: SQLFilterDefinitions = {
    ...baseSQLFilterCompilers,
    id: createSQLColumnFilterCompiler('id'),
    organizationId: createSQLColumnFilterCompiler('organizationId'),
    periodId: createSQLColumnFilterCompiler('periodId'),
};
