import {
    SQL,
    SQLConcat,
    SQLExpressionOptions,
    SQLFilterDefinitions,
    SQLNow,
    SQLNull,
    SQLQuery,
    SQLScalar,
    SQLWhereEqual,
    SQLWhereOr,
    SQLWhereSign,
    baseSQLFilterCompilers,
    createSQLColumnFilterCompiler,
    createSQLExpressionFilterCompiler,
    createSQLFilterNamespace,
    createSQLRelationFilterCompiler,
} from "@stamhoofd/sql";
import { SetupStepType } from "@stamhoofd/structures";

export const organizationFilterCompilers: SQLFilterDefinitions = {
    ...baseSQLFilterCompilers,
    id: createSQLExpressionFilterCompiler(SQL.column("organizations", "id")),
    uri: createSQLExpressionFilterCompiler(SQL.column("organizations", "uri")),
    name: createSQLExpressionFilterCompiler(
        SQL.column("organizations", "name"),
    ),
    active: createSQLExpressionFilterCompiler(
        SQL.column("organizations", "active"),
    ),
    city: createSQLExpressionFilterCompiler(
        SQL.jsonValue(SQL.column("organizations", "address"), "$.value.city"),
        { isJSONValue: true },
    ),
    country: createSQLExpressionFilterCompiler(
        SQL.jsonValue(
            SQL.column("organizations", "address"),
            "$.value.country",
        ),
        { isJSONValue: true },
    ),
    umbrellaOrganization: createSQLExpressionFilterCompiler(
        SQL.jsonValue(
            SQL.column("organizations", "meta"),
            "$.value.umbrellaOrganization",
        ),
        { isJSONValue: true },
    ),
    type: createSQLExpressionFilterCompiler(
        SQL.jsonValue(SQL.column("organizations", "meta"), "$.value.type"),
        { isJSONValue: true },
    ),
    tags: createSQLExpressionFilterCompiler(
        SQL.jsonValue(SQL.column("organizations", "meta"), "$.value.tags"),
        { isJSONValue: true, isJSONObject: true },
    ),
    setupSteps: createSQLRelationFilterCompiler(
        SQL.select()
            .from(SQL.table("organization_registration_periods"))
            .where(
                SQL.column(
                    "organization_registration_periods",
                    "organizationId",
                ),
                SQL.column("organizations", "id"),
            ),
        {
            ...baseSQLFilterCompilers,
            periodId: createSQLColumnFilterCompiler(
                SQL.column("organization_registration_periods", "periodId"),
            ),
            ...Object.fromEntries(
                Object.values(SetupStepType)
                    .map((setupStep) => {
                        return [
                            setupStep,
                            createSQLFilterNamespace({
                                reviewedAt: createSQLExpressionFilterCompiler(
                                    SQL.jsonValue(
                                        SQL.column(
                                            "organization_registration_periods",
                                            "setupSteps",
                                        ),
                                        `$.value.steps.${setupStep}.review.date`,
                                    ),
                                    { isJSONValue: true, isJSONObject: false },
                                ),
                                complete: createSQLExpressionFilterCompiler(
                                    {
                                        getSQL: (
                                            _options?: SQLExpressionOptions,
                                        ): SQLQuery =>
                                            `case when CAST(JSON_UNQUOTE(JSON_EXTRACT(\`organization_registration_periods\`.\`setupSteps\`, "$.value.steps.${setupStep}.finishedSteps")) AS unsigned) >= CAST(JSON_UNQUOTE(JSON_EXTRACT(\`organization_registration_periods\`.\`setupSteps\`, "$.value.steps.${setupStep}.totalSteps")) AS unsigned) then 1 else 0 end`,
                                    },
                                    { isJSONValue: false, isJSONObject: false },
                                ),
                            }),
                        ];
                    }),
            ),
        },
    ),
    packages: createSQLRelationFilterCompiler(
        SQL.select()
            .from(SQL.table("stamhoofd_packages"))
            .where(
                SQL.column("organizationId"),
                SQL.column("organizations", "id"),
            )
            .where(SQL.column("validAt"), SQLWhereSign.NotEqual, new SQLNull())
            .where(
                new SQLWhereOr([
                    new SQLWhereEqual(
                        SQL.column("validUntil"),
                        SQLWhereSign.Equal,
                        new SQLNull(),
                    ),
                    new SQLWhereEqual(
                        SQL.column("validUntil"),
                        SQLWhereSign.Greater,
                        new SQLNow(),
                    ),
                ]),
            )
            .where(
                new SQLWhereOr([
                    new SQLWhereEqual(
                        SQL.column("removeAt"),
                        SQLWhereSign.Equal,
                        new SQLNull(),
                    ),
                    new SQLWhereEqual(
                        SQL.column("removeAt"),
                        SQLWhereSign.Greater,
                        new SQLNow(),
                    ),
                ]),
            ),

        // const pack1 = await STPackage.where({ organizationId, validAt: { sign: "!=", value: null }, removeAt: { sign: ">", value: new Date() }})
        // const pack2 = await STPackage.where({ organizationId, validAt: { sign: "!=", value: null }, removeAt: null })
        {
            ...baseSQLFilterCompilers,
            type: createSQLExpressionFilterCompiler(
                SQL.jsonValue(SQL.column("meta"), "$.value.type"),
                { isJSONValue: true },
            ),
        },
    ),
    members: createSQLRelationFilterCompiler(
        SQL.select()
            .from(SQL.table("members"))
            .join(
                SQL.join(SQL.table("registrations")).where(
                    SQL.column("members", "id"),
                    SQL.column("registrations", "memberId"),
                ),
            )
            .where(
                SQL.column("registrations", "organizationId"),
                SQL.column("organizations", "id"),
            ),

        {
            ...baseSQLFilterCompilers,
            name: createSQLExpressionFilterCompiler(
                new SQLConcat(
                    SQL.column("firstName"),
                    new SQLScalar(" "),
                    SQL.column("lastName"),
                ),
            ),
            firstName: createSQLColumnFilterCompiler("firstName"),
            lastName: createSQLColumnFilterCompiler("lastName"),
            email: createSQLColumnFilterCompiler("email"),
        },
    ),
};
