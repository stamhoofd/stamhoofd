import { baseModernSQLFilterCompilers, createColumnFilter, createExistsFilter, SQL, SQLConcat, SQLModernFilterDefinitions, SQLModernValueType, SQLNow, SQLNull, SQLScalar, SQLWhereEqual, SQLWhereOr, SQLWhereSign } from '@stamhoofd/sql';
import { SetupStepType } from '@stamhoofd/structures';

export const organizationFilterCompilers: SQLModernFilterDefinitions = {
    ...baseModernSQLFilterCompilers,
    id: createColumnFilter({
        expression: SQL.column('organizations', 'id'),
        type: SQLModernValueType.String,
        nullable: false,
    }),
    uriPadded: createColumnFilter({
        expression: SQL.lpad(SQL.column('organizations', 'uri'), 10, '0'),
        type: SQLModernValueType.String,
        nullable: false,
    }),
    uri: createColumnFilter({
        expression: SQL.column('organizations', 'uri'),
        type: SQLModernValueType.String,
        nullable: false,
    }),
    name: createColumnFilter({
        expression: SQL.column('organizations', 'name'),
        type: SQLModernValueType.String,
        nullable: false,
    }),
    active: createColumnFilter({
        expression: SQL.column('organizations', 'active'),
        type: SQLModernValueType.Boolean,
        nullable: false,
    }),
    city: createColumnFilter({
        expression: SQL.jsonValue(SQL.column('organizations', 'address'), '$.value.city'),
        type: SQLModernValueType.JSONString,
        nullable: false,
    }),
    postalCode: createColumnFilter({
        expression: SQL.jsonValue(SQL.column('organizations', 'address'), '$.value.postalCode'),
        type: SQLModernValueType.JSONString,
        nullable: false,
    }),
    country: createColumnFilter({
        expression: SQL.jsonValue(SQL.column('organizations', 'address'), '$.value.country'),
        type: SQLModernValueType.JSONString,
        nullable: false,
    }),
    umbrellaOrganization: createColumnFilter({
        expression: SQL.jsonValue(SQL.column('organizations', 'meta'), '$.value.umbrellaOrganization'),
        type: SQLModernValueType.JSONString,
        nullable: true,
    }),
    type: createColumnFilter({
        expression: SQL.jsonValue(SQL.column('organizations', 'meta'), '$.value.type'),
        type: SQLModernValueType.JSONString,
        nullable: false,
    }),
    tags: createColumnFilter({
        expression: SQL.jsonValue(SQL.column('organizations', 'meta'), '$.value.tags'),
        type: SQLModernValueType.JSONArray,
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
            ...baseModernSQLFilterCompilers,
            periodId: createColumnFilter({
                expression: SQL.column('organization_registration_periods', 'periodId'),
                type: SQLModernValueType.String,
                nullable: false,
            }),
            ...Object.fromEntries(
                Object.values(SetupStepType)
                    .map((setupStep) => {
                        return [
                            setupStep,
                            {
                                ...baseModernSQLFilterCompilers,
                                reviewedAt: createColumnFilter({
                                    expression: SQL.jsonValue(
                                        SQL.column('organization_registration_periods', 'setupSteps'),
                                        `$.value.steps.${setupStep}.review.date`,
                                    ),
                                    type: SQLModernValueType.JSONString,
                                    nullable: true,
                                }),
                                complete: createColumnFilter({
                                    expression: {
                                        getSQL: () =>
                                            `case when CAST(JSON_UNQUOTE(JSON_EXTRACT(\`organization_registration_periods\`.\`setupSteps\`, "$.value.steps.${setupStep}.finishedSteps")) AS unsigned) >= CAST(JSON_UNQUOTE(JSON_EXTRACT(\`organization_registration_periods\`.\`setupSteps\`, "$.value.steps.${setupStep}.totalSteps")) AS unsigned) then 1 else 0 end`,
                                    },
                                    type: SQLModernValueType.Boolean,
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
            ...baseModernSQLFilterCompilers,
            type: createColumnFilter({
                expression: SQL.jsonValue(SQL.column('meta'), '$.value.type'),
                type: SQLModernValueType.JSONString,
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
            ...baseModernSQLFilterCompilers,
            name: createColumnFilter({
                expression: new SQLConcat(
                    SQL.column('firstName'),
                    new SQLScalar(' '),
                    SQL.column('lastName'),
                ),
                type: SQLModernValueType.String,
                nullable: false,
            }),
            firstName: createColumnFilter({
                expression: SQL.column('firstName'),
                type: SQLModernValueType.String,
                nullable: false,
            }),
            lastName: createColumnFilter({
                expression: SQL.column('lastName'),
                type: SQLModernValueType.String,
                nullable: false,
            }),
            email: createColumnFilter({
                expression: SQL.jsonValue(SQL.column('details'), '$.value.email'),
                type: SQLModernValueType.JSONString,
                nullable: true,
            }),
        },
    ),
};
