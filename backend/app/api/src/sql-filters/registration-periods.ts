import { SQLFilterDefinitions, baseSQLFilterCompilers, createSQLColumnFilterCompiler } from '@stamhoofd/sql';

export const registrationPeriodFilterCompilers: SQLFilterDefinitions = {
    ...baseSQLFilterCompilers,
    id: createSQLColumnFilterCompiler('id'),
    startDate: createSQLColumnFilterCompiler('startDate'),
    endDate: createSQLColumnFilterCompiler('endDate'),
};
