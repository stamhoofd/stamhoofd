import { baseSQLFilterCompilers, createColumnFilter, SQL, SQLFilterDefinitions, SQLValueType } from '@stamhoofd/sql';

export const registrationPeriodFilterCompilers: SQLFilterDefinitions = {
    ...baseSQLFilterCompilers,
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
