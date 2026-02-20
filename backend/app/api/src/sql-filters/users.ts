import { baseSQLFilterCompilers, createColumnFilter, SQL, SQLFilterDefinitions, SQLValueType } from '@stamhoofd/sql';

export const userFilterCompilers: SQLFilterDefinitions = {
    ...baseSQLFilterCompilers,
    verified: createColumnFilter({
        expression: SQL.column('verified'),
        type: SQLValueType.Boolean,
        nullable: false,
    }),
};
