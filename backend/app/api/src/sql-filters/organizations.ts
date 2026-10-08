import type { SQLFilterDefinitions } from '@stamhoofd/sql';
import { baseSQLFilterCompilers, compileToSQLFilter, createColumnFilter, createExistsFilter, SQL, SQLConcat, SQLNow, SQLNull, SQLScalar, SQLValueType, SQLWhereAnd, SQLWhereEqual, SQLWhereOr, SQLWhereSign } from '@stamhoofd/sql';
import { PermissionLevel, SetupStepType } from '@stamhoofd/structures';
import { Context } from '../helpers/Context.js';

type SQLFilterCompiler = ReturnType<typeof createExistsFilter>;

/**
 * Only the organization's own columns, which every user that can reach the organization may filter on.
 */
const baseOrganizationFilterCompilers: SQLFilterDefinitions = {
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
    createdAt: createColumnFilter({
        expression: SQL.column('organizations', 'createdAt'),
        type: SQLValueType.Datetime,
        nullable: false,
    }),
    street: createColumnFilter({
        expression: SQL.jsonExtract(SQL.column('organizations', 'address'), '$.value.street'),
        type: SQLValueType.JSONString,
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
};

/**
 * Relations and configuration of an organization are only readable by platform admins, also when the
 * organization is reached through a relation of another object (member, registration, webshop, ...).
 * Platform admins limited to tags only match organizations with one of those tags, like GetOrganizationsEndpoint.
 */
function platformOnly(compiler: SQLFilterCompiler): SQLFilterCompiler {
    return (filter, parentCompiler, key) => {
        const runner = compiler(filter, parentCompiler, key);
        if (!runner) {
            return undefined;
        }

        return async (column) => {
            const tags = Context.auth.getPlatformAccessibleOrganizationTags(PermissionLevel.Read);
            if (tags !== 'all' && tags.length === 0) {
                throw Context.auth.error({
                    message: 'Filtering on ' + key + ' of an organization requires platform access',
                    human: $t('%Ztn'),
                });
            }

            const where = await runner(column);
            if (tags === 'all') {
                return where;
            }

            return new SQLWhereAnd([
                await compileToSQLFilter({ tags: { $in: tags } }, baseOrganizationFilterCompilers),
                where,
            ]);
        };
    };
}

export const organizationFilterCompilers: SQLFilterDefinitions = {
    ...baseOrganizationFilterCompilers,
    packages: platformOnly(createExistsFilter(
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
    )),
    members: platformOnly(createExistsFilter(
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
    )),
    admins: platformOnly(createExistsFilter(
        SQL.select()
            .from(SQL.table('users'))
            .where(
                SQL.column('users', 'organizationId'),
                SQL.column('organizations', 'id'),
            )
            .where(SQL.column('users', 'permissions'), SQLWhereSign.NotEqual, new SQLNull()),
        {
            ...baseSQLFilterCompilers,
            name: createColumnFilter({
                expression: new SQLConcat(
                    SQL.coalesce(SQL.column('users', 'firstName'), new SQLScalar('')),
                    new SQLScalar(' '),
                    SQL.coalesce(SQL.column('users', 'lastName'), new SQLScalar('')),
                ),
                type: SQLValueType.String,
                nullable: false,
            }),
            firstName: createColumnFilter({
                expression: SQL.column('users', 'firstName'),
                type: SQLValueType.String,
                nullable: true,
            }),
            lastName: createColumnFilter({
                expression: SQL.column('users', 'lastName'),
                type: SQLValueType.String,
                nullable: true,
            }),
            email: createColumnFilter({
                expression: SQL.column('users', 'email'),
                type: SQLValueType.String,
                nullable: false,
            }),
        },
    )),
    companies: platformOnly(createExistsFilter(
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
    )),
    documentTemplates: platformOnly(createExistsFilter(
        SQL.select()
            .from(SQL.table('document_templates'))
            .where(
                SQL.column('document_templates', 'organizationId'),
                SQL.column('organizations', 'id'),
            ),
        {
            ...baseSQLFilterCompilers,
            type: createColumnFilter({
                expression: SQL.jsonExtract(SQL.column('document_templates', 'privateSettings'), '$.value.templateDefinition.type'),
                type: SQLValueType.JSONString,
                nullable: true,
            }),
            year: createColumnFilter({
                expression: SQL.column('document_templates', 'year'),
                type: SQLValueType.Number,
                nullable: false,
            }),
            status: createColumnFilter({
                expression: SQL.column('document_templates', 'status'),
                type: SQLValueType.String,
                nullable: false,
            }),
            isLocked: createColumnFilter({
                expression: SQL.column('document_templates', 'isLocked'),
                type: SQLValueType.Boolean,
                nullable: false,
            }),
            updatesEnabled: createColumnFilter({
                expression: SQL.column('document_templates', 'updatesEnabled'),
                type: SQLValueType.Boolean,
                nullable: false,
            }),
        },
    )),
    setupSteps: platformOnly(createExistsFilter(
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
    )),
    recordCategoryName: platformOnly(createColumnFilter({
        expression: SQL.jsonExtract(SQL.column('organizations', 'meta'), '$.value.recordsConfiguration.recordCategories[*].name'),
        type: SQLValueType.JSONArray,
        nullable: true,
    })),
    // Name of a child (sub)category in any record category, at any nesting depth
    recordChildCategoryName: platformOnly(createColumnFilter({
        expression: SQL.jsonExtract(SQL.column('organizations', 'meta'), '$.value.recordsConfiguration.recordCategories**.childCategories[*].name'),
        type: SQLValueType.JSONArray,
        nullable: true,
    })),
    recordName: platformOnly(createColumnFilter({
        expression: SQL.jsonExtract(SQL.column('organizations', 'meta'), '$.value.recordsConfiguration.recordCategories**.records[*].name'),
        type: SQLValueType.JSONArray,
        nullable: true,
    })),
};
