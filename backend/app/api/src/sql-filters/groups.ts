import { baseSQLFilterCompilers, createColumnFilter, createWildcardColumnFilter, SQL, SQLFilterDefinitions, SQLJsonExtract, SQLValueType } from '@stamhoofd/sql';

export const groupFilterCompilers: SQLFilterDefinitions = {
    ...baseSQLFilterCompilers,
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
    name: createColumnFilter({
        expression: SQL.jsonExtract(SQL.column('settings'), '$.value.name'),
        type: SQLValueType.JSONString,
        nullable: false,
    }),
    status: createColumnFilter({
        expression: SQL.column('status'),
        type: SQLValueType.String,
        nullable: false,
    }),
    defaultAgeGroupId: createColumnFilter({
        expression: SQL.column('defaultAgeGroupId'),
        type: SQLValueType.String,
        nullable: true,
    }),
    bundleDiscounts: createWildcardColumnFilter(
        (key: string) => ({
            expression: SQL.jsonExtract(SQL.column('settings'), `$.value.prices[*].bundleDiscounts.${SQLJsonExtract.escapePathComponent(key)}`, true),
            type: SQLValueType.JSONArray,
            nullable: true,
        }),
        (key: string) => ({
            ...baseSQLFilterCompilers,
            name: createColumnFilter({
                expression: SQL.jsonExtract(SQL.column('settings'), `$.value.prices[*].bundleDiscounts.${SQLJsonExtract.escapePathComponent(key)}.name`, true),
                type: SQLValueType.JSONArray,
                nullable: true,
            }),
        }),
    ),
};
