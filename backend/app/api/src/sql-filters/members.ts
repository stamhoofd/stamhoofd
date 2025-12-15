import { SimpleError } from '@simonbackx/simple-errors';
import { Email, Member } from '@stamhoofd/models';
import { baseSQLFilterCompilers, createColumnFilter, createExistsFilter, createWildcardColumnFilter, SQL, SQLAge, SQLCast, SQLConcat, SQLFilterDefinitions, SQLJsonExtract, SQLScalar, SQLValueType } from '@stamhoofd/sql';
import { AccessRight } from '@stamhoofd/structures';
import { Context } from '../helpers/Context.js';
import { baseRegistrationFilterCompilers } from './base-registration-filter-compilers.js';
import { organizationFilterCompilers } from './organizations.js';

const membersTable = SQL.table(Member.table);

/**
 * Defines how to filter members in the database from StamhoofdFilter objects
 */
export const memberFilterCompilers: SQLFilterDefinitions = {
    ...baseSQLFilterCompilers,
    'id': createColumnFilter({
        expression: SQL.column(membersTable, 'id'),
        type: SQLValueType.String,
        nullable: false,
    }),
    'memberNumber': createColumnFilter({
        expression: SQL.column(membersTable, 'memberNumber'),
        type: SQLValueType.String,
        nullable: true,
    }),
    'firstName': createColumnFilter({
        expression: SQL.column(membersTable, 'firstName'),
        type: SQLValueType.String,
        nullable: false,
    }),
    'lastName': createColumnFilter({
        expression: SQL.column(membersTable, 'lastName'),
        type: SQLValueType.String,
        nullable: false,
    }),
    'name': createColumnFilter({
        expression: new SQLConcat(
            SQL.column(membersTable, 'firstName'),
            new SQLScalar(' '),
            SQL.column(membersTable, 'lastName'),
        ),
        type: SQLValueType.String,
        nullable: false,
    }),
    'age': createColumnFilter({
        expression: new SQLAge(SQL.column(membersTable, 'birthDay')),
        type: SQLValueType.Number,
        nullable: true,
    }),
    'gender': createColumnFilter({
        expression: SQL.jsonExtract(SQL.column(membersTable, 'details'), '$.value.gender'),
        type: SQLValueType.JSONString,
        nullable: false,
    }),
    'birthDay': createColumnFilter({
        // todo: check normalization of date
        expression: SQL.column(membersTable, 'birthDay'),
        type: SQLValueType.Datetime,
        nullable: true,
    }),
    'createdAt': createColumnFilter({
        expression: SQL.column(membersTable, 'createdAt'),
        type: SQLValueType.Datetime,
        nullable: false,
    }),
    'organizationName': createColumnFilter({
        expression: SQL.column('organizations', 'name'),
        type: SQLValueType.String,
        nullable: false,
    }),
    'details.requiresFinancialSupport': createColumnFilter({
        expression: SQL.jsonExtract(SQL.column(membersTable, 'details'), '$.value.requiresFinancialSupport.value'),
        type: SQLValueType.JSONBoolean,
        nullable: true,
        checkPermission: async () => {
            const organization = Context.organization;
            if (!organization) {
                if (!Context.auth.hasPlatformFullAccess()) {
                    throw new SimpleError({
                        code: 'permission_denied',
                        message: 'No permissions for financial support filter.',
                        human: $t(`64d658fa-0727-4924-9448-b243fe8e10a1`),
                        statusCode: 400,
                    });
                }
                return;
            }

            const permissions = await Context.auth.getOrganizationPermissions(organization);

            if (!permissions || !permissions.hasAccessRight(AccessRight.MemberReadFinancialData)) {
                throw new SimpleError({
                    code: 'permission_denied',
                    message: 'No permissions for financial support filter (organization scope).',
                    human: $t(`64d658fa-0727-4924-9448-b243fe8e10a1`),
                    statusCode: 400,
                });
            }
        },
    }),
    'email': createColumnFilter({
        expression: SQL.jsonExtract(SQL.column(membersTable, 'details'), '$.value.email'),
        type: SQLValueType.JSONString,
        nullable: true,
    }),
    'parentEmail': createColumnFilter({
        expression: SQL.jsonExtract(SQL.column(membersTable, 'details'), '$.value.parents[*].email'),
        type: SQLValueType.JSONArray,
        nullable: true,
    }),
    'details.parents[0]': {
        ...baseSQLFilterCompilers,
        name: createColumnFilter({
            expression: new SQLCast(
                new SQLConcat(
                    SQL.jsonUnquotedValue(SQL.column(membersTable, 'details'), '$.value.parents[0].firstName'),
                    new SQLScalar(' '),
                    SQL.jsonUnquotedValue(SQL.column(membersTable, 'details'), '$.value.parents[0].lastName'),
                ),
                'CHAR'),
            type: SQLValueType.String,
            nullable: true,
        }),
    },
    'details.parents[1]': {
        ...baseSQLFilterCompilers,
        name: createColumnFilter({
            expression: new SQLCast(
                new SQLConcat(
                    SQL.jsonUnquotedValue(SQL.column(membersTable, 'details'), '$.value.parents[1].firstName'),
                    new SQLScalar(' '),
                    SQL.jsonUnquotedValue(SQL.column(membersTable, 'details'), '$.value.parents[1].lastName'),
                ),
                'CHAR'),
            type: SQLValueType.String,
            nullable: true,
        }),
    },
    'unverifiedEmail': createColumnFilter({
        expression: SQL.jsonExtract(SQL.column(membersTable, 'details'), '$.value.unverifiedEmails'),
        type: SQLValueType.JSONArray,
        nullable: true,
    }),
    'phone': createColumnFilter({
        expression: SQL.jsonExtract(SQL.column(membersTable, 'details'), '$.value.phone'),
        type: SQLValueType.JSONString,
        nullable: true,
    }),
    'details.address': {
        ...baseSQLFilterCompilers,
        city: createColumnFilter({
            expression: SQL.jsonExtract(SQL.column(membersTable, 'details'), '$.value.address.city'),
            type: SQLValueType.JSONString,
            nullable: true,
        }),
        postalCode: createColumnFilter({
            expression: SQL.jsonExtract(SQL.column(membersTable, 'details'), '$.value.address.postalCode'),
            type: SQLValueType.JSONString,
            nullable: true,
        }),
        street: createColumnFilter({
            expression: SQL.jsonExtract(SQL.column(membersTable, 'details'), '$.value.address.street'),
            type: SQLValueType.JSONString,
            nullable: true,
        }),
        number: createColumnFilter({
            expression: SQL.jsonExtract(SQL.column(membersTable, 'details'), '$.value.address.number'),
            type: SQLValueType.JSONString,
            nullable: true,
        }),
    },
    'details.parents[*].address': {
        ...baseSQLFilterCompilers,
        city: createColumnFilter({
            expression: SQL.jsonExtract(SQL.column(membersTable, 'details'), '$.value.parents[*].address.city'),
            type: SQLValueType.JSONArray,
            nullable: true,
        }),
        postalCode: createColumnFilter({
            expression: SQL.jsonExtract(SQL.column(membersTable, 'details'), '$.value.parents[*].address.postalCode'),
            type: SQLValueType.JSONArray,
            nullable: true,
        }),
        street: createColumnFilter({
            expression: SQL.jsonExtract(SQL.column(membersTable, 'details'), '$.value.parents[*].address.street'),
            type: SQLValueType.JSONArray,
            nullable: true,
        }),
        number: createColumnFilter({
            expression: SQL.jsonExtract(SQL.column(membersTable, 'details'), '$.value.parents[*].address.number'),
            type: SQLValueType.JSONArray,
            nullable: true,
        }),
    },
    'parentPhone': createColumnFilter({
        expression: SQL.jsonExtract(SQL.column(membersTable, 'details'), '$.value.parents[*].phone'),
        type: SQLValueType.JSONArray,
        nullable: true,
    }),
    'unverifiedPhone': createColumnFilter({
        expression: SQL.jsonExtract(SQL.column(membersTable, 'details'), '$.value.unverifiedPhones'),
        type: SQLValueType.JSONArray,
        nullable: true,
    }),
    'registrations': createExistsFilter(
        SQL.select()
            .from(
                SQL.table('registrations'),
            ).join(
                SQL.join(
                    SQL.table('groups'),
                ).where(
                    SQL.column('groups', 'id'),
                    SQL.column('registrations', 'groupId'),
                ),
            )
            .where(
                SQL.column('memberId'),
                SQL.column('members', 'id'),
            ).whereNot(
                SQL.column('registeredAt'),
                null,
            ).where(
                SQL.column('deactivatedAt'),
                null,
            ).where(
                SQL.column('groups', 'deletedAt'),
                null,
            ),
        {
            ...baseRegistrationFilterCompilers,
            // Override the registration periodId - can be outdated - and always use the group periodId
            periodId: createColumnFilter({
                expression: SQL.column('groups', 'periodId'),
                type: SQLValueType.String,
                nullable: false,
            }),
        },
    ),
    'responsibilities': createExistsFilter(
        SQL.select()
            .from(
                SQL.table('member_responsibility_records'),
            )
            .join(
                SQL.leftJoin(
                    SQL.table('groups'),
                ).where(
                    SQL.column('groups', 'id'),
                    SQL.column('member_responsibility_records', 'groupId'),
                ),
            )
            .join(
                SQL.leftJoin(
                    SQL.table('organizations'),
                ).where(
                    SQL.column('organizations', 'id'),
                    SQL.column('member_responsibility_records', 'organizationId'),
                ),
            )
            .where(
                SQL.column('memberId'),
                SQL.column('members', 'id'),
            ),
        {
            ...baseSQLFilterCompilers,
            // Alias for responsibilityId
            id: createColumnFilter({
                expression: SQL.column('member_responsibility_records', 'responsibilityId'),
                type: SQLValueType.String,
                nullable: false,
            }),
            responsibilityId: createColumnFilter({
                expression: SQL.column('member_responsibility_records', 'responsibilityId'),
                type: SQLValueType.String,
                nullable: false,
            }),
            organizationId: createColumnFilter({
                expression: SQL.column('member_responsibility_records', 'organizationId'),
                type: SQLValueType.String,
                nullable: false,
            }),
            startDate: createColumnFilter({
                expression: SQL.column('member_responsibility_records', 'startDate'),
                type: SQLValueType.Datetime,
                nullable: false,
            }),
            endDate: createColumnFilter({
                expression: SQL.column('member_responsibility_records', 'endDate'),
                type: SQLValueType.Datetime,
                nullable: true,
            }),
            group: {
                ...baseSQLFilterCompilers,
                id: createColumnFilter({
                    expression: SQL.column('groups', 'id'),
                    type: SQLValueType.String,
                    nullable: false,
                }),
                defaultAgeGroupId: createColumnFilter({
                    expression: SQL.column('groups', 'defaultAgeGroupId'),
                    type: SQLValueType.String,
                    nullable: true,
                }),
            },
            organization: organizationFilterCompilers,
        },
    ),
    'platformMemberships': createExistsFilter(
        SQL.select()
            .from(
                SQL.table('member_platform_memberships'),
            )
            .where(
                SQL.column('memberId'),
                SQL.column('members', 'id'),
            )
            .where(
                SQL.column('deletedAt'),
                null,
            ),
        {
            ...baseSQLFilterCompilers,
            id: createColumnFilter({
                expression: SQL.column('member_platform_memberships', 'id'),
                type: SQLValueType.String,
                nullable: false,
            }),
            membershipTypeId: createColumnFilter({
                expression: SQL.column('member_platform_memberships', 'membershipTypeId'),
                type: SQLValueType.String,
                nullable: false,
            }),
            organizationId: createColumnFilter({
                expression: SQL.column('member_platform_memberships', 'organizationId'),
                type: SQLValueType.String,
                nullable: false,
            }),
            periodId: createColumnFilter({
                expression: SQL.column('member_platform_memberships', 'periodId'),
                type: SQLValueType.String,
                nullable: false,
            }),
            price: createColumnFilter({
                expression: SQL.column('member_platform_memberships', 'price'),
                type: SQLValueType.Number,
                nullable: false,
            }),
            priceWithoutDiscount: createColumnFilter({
                expression: SQL.column('member_platform_memberships', 'priceWithoutDiscount'),
                type: SQLValueType.Number,
                nullable: false,
            }),
            startDate: createColumnFilter({
                expression: SQL.column('member_platform_memberships', 'startDate'),
                type: SQLValueType.Datetime,
                nullable: false,
            }),
            endDate: createColumnFilter({
                expression: SQL.column('member_platform_memberships', 'endDate'),
                type: SQLValueType.Datetime,
                nullable: false,
            }),
            expireDate: createColumnFilter({
                expression: SQL.column('member_platform_memberships', 'expireDate'),
                type: SQLValueType.Datetime,
                nullable: true,
            }),
            trialUntil: createColumnFilter({
                expression: SQL.column('member_platform_memberships', 'trialUntil'),
                type: SQLValueType.Datetime,
                nullable: true,
            }),
            locked: createColumnFilter({
                expression: SQL.column('member_platform_memberships', 'locked'),
                type: SQLValueType.Boolean,
                nullable: false,
            }),
            balanceItemId: createColumnFilter({
                expression: SQL.column('member_platform_memberships', 'balanceItemId'),
                type: SQLValueType.String,
                nullable: true,
            }),
            generated: createColumnFilter({
                expression: SQL.column('member_platform_memberships', 'generated'),
                type: SQLValueType.Boolean,
                nullable: false,
            }),
        },
    ),
    'organizations': createExistsFilter(
        SQL.select()
            .from(
                SQL.table('registrations'),
            ).join(
                SQL.join(
                    SQL.table('groups'),
                ).where(
                    SQL.column('groups', 'id'),
                    SQL.column('registrations', 'groupId'),
                ),
            ).join(
                SQL.join(
                    SQL.table('organizations'),
                ).where(
                    SQL.column('organizations', 'id'),
                    SQL.column('registrations', 'organizationId'),
                ),
            ).where(
                SQL.column('memberId'),
                SQL.column('members', 'id'),
            ).whereNot(
                SQL.column('registeredAt'),
                null,
            ).where(
                SQL.column('groups', 'deletedAt'),
                null,
            ),
        organizationFilterCompilers,
    ),
    'emails': createExistsFilter(
        SQL.select()
            .from(
                SQL.table('email_recipients'),
            ).where(
                SQL.column('memberId'),
                SQL.column('members', 'id'),
            ),
        {
            ...baseSQLFilterCompilers,
            id: createColumnFilter({
                expression: SQL.column('emailId'),
                type: SQLValueType.String,
                nullable: false,
                checkPermission: async (filter) => {
                    if (typeof filter !== 'string') {
                        throw new SimpleError({
                            code: 'invalid_filter',
                            message: 'This filter structure is not supported here.',
                        });
                    }
                    const id = filter;
                    const email = await Email.getByID(id);
                    if (!email) {
                        throw new SimpleError({
                            code: 'not_found',
                            message: 'This email does not exist.',
                            human: $t('491156e4-a75d-4487-a97e-b208cd3a1d11'),
                            statusCode: 404,
                        });
                    }
                    if (!await Context.auth.canAccessEmail(email)) {
                        throw Context.auth.error({
                            message: 'No permissions to access this email.',
                            human: $t('be46002c-d77e-42ca-b163-23bde0bc628c'),
                        });
                    }
                },
            }),
        },
    ),
    'details': {
        ...baseSQLFilterCompilers,
        recordAnswers: createWildcardColumnFilter(
            (key: string) => ({
                expression: SQL.jsonExtract(SQL.column('details'), `$.value.recordAnswers.${SQLJsonExtract.escapePathComponent(key)}`, true),
                type: SQLValueType.JSONObject,
                nullable: true,
            }),
            (key: string) => ({
                ...baseSQLFilterCompilers,
                selected: createColumnFilter({
                    expression: SQL.jsonExtract(SQL.column('details'), `$.value.recordAnswers.${SQLJsonExtract.escapePathComponent(key)}.selected`, true),
                    type: SQLValueType.JSONBoolean,
                    nullable: true,
                }),
                selectedChoice: {
                    ...baseSQLFilterCompilers,
                    id: createColumnFilter({
                        expression: SQL.jsonExtract(SQL.column('details'), `$.value.recordAnswers.${SQLJsonExtract.escapePathComponent(key)}.selectedChoice.id`, true),
                        type: SQLValueType.JSONString,
                        nullable: true,
                    }),
                },
                selectedChoices: {
                    ...baseSQLFilterCompilers,
                    id: createColumnFilter({
                        expression: SQL.jsonExtract(SQL.column('details'), `$.value.recordAnswers.${SQLJsonExtract.escapePathComponent(key)}.selectedChoices[*].id`, true),
                        type: SQLValueType.JSONArray,
                        nullable: true,
                    }),
                },
                value: createColumnFilter({
                    expression: SQL.jsonExtract(SQL.column('details'), `$.value.recordAnswers.${SQLJsonExtract.escapePathComponent(key)}.value`, true),
                    type: SQLValueType.JSONString,
                    nullable: true,
                }),
            }),
            {
                checkPermission: async (key: string) => {
                    const result = await Context.auth.canFilterMembersOnRecordId(key);
                    if (!result.canAccess) {
                        throw new SimpleError({
                            code: 'permission_denied',
                            message: 'No permissions to filter on record ' + key,
                            human: result.record ? $t(`3560487e-3f2c-4cc9-ad7f-4e9a0fc1bbb8`, { recordName: result.record.name }) : $t(`Je hebt niet voldoende toegangsrechten om te filteren op dit gegevensveld`),
                            statusCode: 400,
                        });
                    }
                },
            },
        ),
    },
};
