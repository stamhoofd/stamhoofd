import { baseSQLFilterCompilers, createColumnFilter, createExistsFilter, SQL, SQLConcat, SQLFilterDefinitions, SQLNow, SQLNull, SQLScalar, SQLValueType, SQLWhereEqual, SQLWhereOr, SQLWhereSign } from '@stamhoofd/sql';
import { SetupStepType } from '@stamhoofd/structures';

export const organizationFilterCompilers: SQLFilterDefinitions = {
    ...baseSQLFilterCompilers,
    id: createColumnFilter({
        expression: SQL.column('organizations', 'id'),
        type: SQLValueType.String,
        nullable: false,
    }),
    uriPadded: createColumnFilter({
        expression: SQL.lpad(SQL.column('organizations', 'uri'), 10, '0'),
        type: SQLValueType.String,
        nullable: false,
    }),
    uri: createColumnFilter({
        expression: SQL.column('organizations', 'uri'),
        type: SQLValueType.String,
        nullable: false,
    }),
    name: createColumnFilter({
        expression: SQL.column('organizations', 'name'),
        type: SQLValueType.String,
        nullable: false,
    }),
    active: createColumnFilter({
        expression: SQL.column('organizations', 'active'),
        type: SQLValueType.Boolean,
        nullable: false,
    }),
    city: createColumnFilter({
        expression: SQL.jsonExtract(SQL.column('organizations', 'address'), '$.value.city'),
        type: SQLValueType.JSONString,
        nullable: false,
    }),
    postalCode: createColumnFilter({
        expression: SQL.jsonExtract(SQL.column('organizations', 'address'), '$.value.postalCode'),
        type: SQLValueType.JSONString,
        nullable: false,
    }),
    country: createColumnFilter({
        expression: SQL.jsonExtract(SQL.column('organizations', 'address'), '$.value.country'),
        type: SQLValueType.JSONString,
        nullable: false,
    }),
    umbrellaOrganization: createColumnFilter({
        expression: SQL.jsonExtract(SQL.column('organizations', 'meta'), '$.value.umbrellaOrganization'),
        type: SQLValueType.JSONString,
        nullable: true,
    }),
    type: createColumnFilter({
        expression: SQL.jsonExtract(SQL.column('organizations', 'meta'), '$.value.type'),
        type: SQLValueType.JSONString,
        nullable: false,
    }),
    tags: createColumnFilter({
        expression: SQL.jsonExtract(SQL.column('organizations', 'meta'), '$.value.tags'),
        type: SQLValueType.JSONArray,
        nullable: false,
    }),
    setupSteps: createExistsFilter(
        SQL.select()
            .from(SQL.table('organization_registration_periods'))
            .where(
                SQL.column('organization_registration_periods', 'organizationId'),
                SQL.column('organizations', 'id'),
            ),
        {
            ...baseSQLFilterCompilers,
            periodId: createColumnFilter({
                expression: SQL.column('organization_registration_periods', 'periodId'),
                type: SQLValueType.String,
                nullable: false,
            }),
            ...Object.fromEntries(
                Object.values(SetupStepType)
                    .map((setupStep) => {
                        return [
                            setupStep,
                            {
                                ...baseSQLFilterCompilers,
                                reviewedAt: createColumnFilter({
                                    expression: SQL.jsonExtract(
                                        SQL.column('organization_registration_periods', 'setupSteps'),
                                        `$.value.steps.${setupStep}.review.date`,
                                    ),
                                    type: SQLValueType.JSONString,
                                    nullable: true,
                                }),
                                complete: createColumnFilter({
                                    expression: {
                                        getSQL: () =>
                                            `case when CAST(JSON_UNQUOTE(JSON_EXTRACT(\`organization_registration_periods\`.\`setupSteps\`, "$.value.steps.${setupStep}.finishedSteps")) AS unsigned) >= CAST(JSON_UNQUOTE(JSON_EXTRACT(\`organization_registration_periods\`.\`setupSteps\`, "$.value.steps.${setupStep}.totalSteps")) AS unsigned) then 1 else 0 end`,
                                    },
                                    type: SQLValueType.Boolean,
                                    nullable: false,
                                }),
                            },
                        ];
                    }),
            ),
        },
    ),
    packages: createExistsFilter(
        SQL.select()
            .from(SQL.table('stamhoofd_packages'))
            .where(
                SQL.column('organizationId'),
                SQL.column('organizations', 'id'),
            )
            .where(SQL.column('validAt'), SQLWhereSign.NotEqual, new SQLNull())
            .where(
                new SQLWhereOr([
                    new SQLWhereEqual(
                        SQL.column('validUntil'),
                        SQLWhereSign.Equal,
                        new SQLNull(),
                    ),
                    new SQLWhereEqual(
                        SQL.column('validUntil'),
                        SQLWhereSign.Greater,
                        new SQLNow(),
                    ),
                ]),
            )
            .where(
                new SQLWhereOr([
                    new SQLWhereEqual(
                        SQL.column('removeAt'),
                        SQLWhereSign.Equal,
                        new SQLNull(),
                    ),
                    new SQLWhereEqual(
                        SQL.column('removeAt'),
                        SQLWhereSign.Greater,
                        new SQLNow(),
                    ),
                ]),
            ),
        {
            ...baseSQLFilterCompilers,
            type: createColumnFilter({
                expression: SQL.jsonExtract(SQL.column('meta'), '$.value.type'),
                type: SQLValueType.JSONString,
                nullable: false,
            }),
        },
    ),
    members: createExistsFilter(
        SQL.select()
            .from(SQL.table('members'))
            .join(
                SQL.join(SQL.table('registrations')).where(
                    SQL.column('members', 'id'),
                    SQL.column('registrations', 'memberId'),
                ),
            )
            .where(
                SQL.column('registrations', 'organizationId'),
                SQL.column('organizations', 'id'),
            ),
        {
            ...baseSQLFilterCompilers,
            name: createColumnFilter({
                expression: new SQLConcat(
                    SQL.column('firstName'),
                    new SQLScalar(' '),
                    SQL.column('lastName'),
                ),
                type: SQLValueType.String,
                nullable: false,
            }),
            firstName: createColumnFilter({
                expression: SQL.column('firstName'),
                type: SQLValueType.String,
                nullable: false,
            }),
            lastName: createColumnFilter({
                expression: SQL.column('lastName'),
                type: SQLValueType.String,
                nullable: false,
            }),
            email: createColumnFilter({
                expression: SQL.jsonExtract(SQL.column('details'), '$.value.email'),
                type: SQLValueType.JSONString,
                nullable: true,
            }),
        },
    ),
    companies: createExistsFilter(
        /**
         * There is a bug in MySQL 8 that is fixed in 9.3
         * where EXISTS (select * from json_table(...)) does not work
         * To fix this, we do a double select with join inside the select
         * It is a bit slower, but it works for now.
         */
        SQL.select()
            .from('organizations', 'innerOrganizations')
            .join(
                SQL.join(
                    SQL.jsonTable(
                        SQL.jsonExtract(SQL.column('innerOrganizations', 'meta'), '$.value.companies'),
                        'companies',
                    )
                        .addColumn(
                            'companyNumber',
                            'TEXT',
                            '$.companyNumber',
                        )
                        .addColumn(
                            'VATNumber',
                            'TEXT',
                            '$.VATNumber',
                        )
                        .addColumn(
                            'name',
                            'TEXT',
                            '$.name',
                        ),
                ),
            )
            .where(SQL.column('innerOrganizations', 'id'), SQL.column('organizations', 'id')),
        {
            ...baseSQLFilterCompilers,
            name: createColumnFilter({
                expression: SQL.column('companies', 'name'),
                type: SQLValueType.String,
                nullable: true,
            }),
            companyNumber: createColumnFilter({
                expression: SQL.column('companies', 'companyNumber'),
                type: SQLValueType.String,
                nullable: true,
            }),
            VATNumber: createColumnFilter({
                expression: SQL.column('companies', 'VATNumber'),
                type: SQLValueType.String,
                nullable: true,
            }),
        },
    ),
};
