import { baseModernSQLFilterCompilers, createColumnFilter, SQL, SQLModernFilterDefinitions, SQLValueType } from '@stamhoofd/sql';

export const registrationPeriodFilterCompilers: SQLModernFilterDefinitions = {
    ...baseModernSQLFilterCompilers,
    id: createColumnFilter({
        expression: SQL.column('id'),
        type: SQLValueType.String,
        nullable: false,
    }),
    startDate: createColumnFilter({
        expression: SQL.column('startDate'),
        type: SQLValueType.Datetime,
        nullable: false,
    }),
    endDate: createColumnFilter({
        expression: SQL.column('endDate'),
        type: SQLValueType.Datetime,
        nullable: false,
    }),
};
