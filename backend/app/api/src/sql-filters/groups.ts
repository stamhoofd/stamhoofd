import { baseModernSQLFilterCompilers, createColumnFilter, createWildcardColumnFilter, SQL, SQLJsonExtract, SQLModernFilterDefinitions, SQLModernValueType } from '@stamhoofd/sql';

export const groupFilterCompilers: SQLModernFilterDefinitions = {
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
    name: createColumnFilter({
        expression: SQL.jsonValue(SQL.column('settings'), '$.value.name'),
        type: SQLModernValueType.JSONString,
        nullable: false,
    }),
    status: createColumnFilter({
        expression: SQL.column('status'),
        type: SQLModernValueType.String,
        nullable: false,
    }),
    defaultAgeGroupId: createColumnFilter({
        expression: SQL.column('defaultAgeGroupId'),
        type: SQLModernValueType.String,
        nullable: true,
    }),
    bundleDiscounts: createWildcardColumnFilter(
        (key: string) => ({
            expression: SQL.jsonValue(SQL.column('settings'), `$.value.prices[*].bundleDiscounts.${SQLJsonExtract.escapePathComponent(key)}`, true),
            type: SQLModernValueType.JSONArray,
            nullable: true,
        }),
        (key: string) => ({
            ...baseModernSQLFilterCompilers,
            name: createColumnFilter({
                expression: SQL.jsonValue(SQL.column('settings'), `$.value.prices[*].bundleDiscounts.${SQLJsonExtract.escapePathComponent(key)}.name`, true),
                type: SQLModernValueType.JSONArray,
                nullable: true,
            }),
        }),
    ),
};
