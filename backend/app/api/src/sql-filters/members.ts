import { SimpleError } from '@simonbackx/simple-errors';
import { Member } from '@stamhoofd/models';
import { baseModernSQLFilterCompilers, createColumnFilter, createExistsFilter, SQL, SQLAge, SQLCast, SQLConcat, SQLModernFilterDefinitions, SQLModernValueType, SQLScalar } from '@stamhoofd/sql';
import { AccessRight } from '@stamhoofd/structures';
import { Context } from '../helpers/Context';
import { baseRegistrationFilterCompilers } from './base-registration-filter-compilers';
import { organizationFilterCompilers } from './organizations';

const membersTable = SQL.table(Member.table);

/**
 * Defines how to filter members in the database from StamhoofdFilter objects
 */
export const memberFilterCompilers: SQLModernFilterDefinitions = {
    ...baseModernSQLFilterCompilers,
    'id': createColumnFilter({
        expression: SQL.column(membersTable, 'id'),
        type: SQLModernValueType.String,
        nullable: false,
    }),
    'memberNumber': createColumnFilter({
        expression: SQL.column(membersTable, 'memberNumber'),
        type: SQLModernValueType.Number,
        nullable: true,
    }),
    'firstName': createColumnFilter({
        expression: SQL.column(membersTable, 'firstName'),
        type: SQLModernValueType.String,
        nullable: false,
    }),
    'lastName': createColumnFilter({
        expression: SQL.column(membersTable, 'lastName'),
        type: SQLModernValueType.String,
        nullable: false,
    }),
    'name': createColumnFilter({
        expression: new SQLConcat(
            SQL.column(membersTable, 'firstName'),
            new SQLScalar(' '),
            SQL.column(membersTable, 'lastName'),
        ),
        type: SQLModernValueType.String,
        nullable: false,
    }),
    'age': createColumnFilter({
        expression: new SQLAge(SQL.column(membersTable, 'birthDay')),
        type: SQLModernValueType.Number,
        nullable: true,
    }),
    'gender': createColumnFilter({
        expression: SQL.jsonValue(SQL.column(membersTable, 'details'), '$.value.gender'),
        type: SQLModernValueType.JSONString,
        nullable: false,
    }),
    'birthDay': createColumnFilter({
        // todo: check normalization of date
        expression: SQL.column(membersTable, 'birthDay'),
        type: SQLModernValueType.Datetime,
        nullable: true,
    }),
    'organizationName': createColumnFilter({
        expression: SQL.column('organizations', 'name'),
        type: SQLModernValueType.String,
        nullable: false,
    }),
    'details.requiresFinancialSupport': createColumnFilter({
        expression: SQL.jsonValue(SQL.column(membersTable, 'details'), '$.value.requiresFinancialSupport.value'),
        type: SQLModernValueType.JSONBoolean,
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
        expression: SQL.jsonValue(SQL.column(membersTable, 'details'), '$.value.email'),
        type: SQLModernValueType.JSONString,
        nullable: true,
    }),
    'parentEmail': createColumnFilter({
        expression: SQL.jsonValue(SQL.column(membersTable, 'details'), '$.value.parents[*].email'),
        type: SQLModernValueType.JSONArray,
        nullable: true,
    }),
    'details.parents[0]': {
        ...baseModernSQLFilterCompilers,
        name: createColumnFilter({
            expression: new SQLCast(
                new SQLConcat(
                    SQL.jsonUnquotedValue(SQL.column(membersTable, 'details'), '$.value.parents[0].firstName'),
                    new SQLScalar(' '),
                    SQL.jsonUnquotedValue(SQL.column(membersTable, 'details'), '$.value.parents[0].lastName'),
                ),
                'CHAR'),
            type: SQLModernValueType.String,
            nullable: true,
        }),
    },
    'details.parents[1]': {
        ...baseModernSQLFilterCompilers,
        name: createColumnFilter({
            expression: new SQLCast(
                new SQLConcat(
                    SQL.jsonUnquotedValue(SQL.column(membersTable, 'details'), '$.value.parents[1].firstName'),
                    new SQLScalar(' '),
                    SQL.jsonUnquotedValue(SQL.column(membersTable, 'details'), '$.value.parents[1].lastName'),
                ),
                'CHAR'),
            type: SQLModernValueType.String,
            nullable: true,
        }),
    },
    'unverifiedEmail': createColumnFilter({
        expression: SQL.jsonValue(SQL.column(membersTable, 'details'), '$.value.unverifiedEmails'),
        type: SQLModernValueType.JSONArray,
        nullable: true,
    }),
    'phone': createColumnFilter({
        expression: SQL.jsonValue(SQL.column(membersTable, 'details'), '$.value.phone'),
        type: SQLModernValueType.JSONString,
        nullable: true,
    }),
    'details.address': {
        ...baseModernSQLFilterCompilers,
        city: createColumnFilter({
            expression: SQL.jsonValue(SQL.column(membersTable, 'details'), '$.value.address.city'),
            type: SQLModernValueType.JSONString,
            nullable: true,
        }),
        postalCode: createColumnFilter({
            expression: SQL.jsonValue(SQL.column(membersTable, 'details'), '$.value.address.postalCode'),
            type: SQLModernValueType.JSONString,
            nullable: true,
        }),
        street: createColumnFilter({
            expression: SQL.jsonValue(SQL.column(membersTable, 'details'), '$.value.address.street'),
            type: SQLModernValueType.JSONString,
            nullable: true,
        }),
        number: createColumnFilter({
            expression: SQL.jsonValue(SQL.column(membersTable, 'details'), '$.value.address.number'),
            type: SQLModernValueType.JSONString,
            nullable: true,
        }),
    },
    'details.parents[*].address': {
        ...baseModernSQLFilterCompilers,
        city: createColumnFilter({
            expression: SQL.jsonValue(SQL.column(membersTable, 'details'), '$.value.parents[*].address.city'),
            type: SQLModernValueType.JSONArray,
            nullable: true,
        }),
        postalCode: createColumnFilter({
            expression: SQL.jsonValue(SQL.column(membersTable, 'details'), '$.value.parents[*].address.postalCode'),
            type: SQLModernValueType.JSONArray,
            nullable: true,
        }),
        street: createColumnFilter({
            expression: SQL.jsonValue(SQL.column(membersTable, 'details'), '$.value.parents[*].address.street'),
            type: SQLModernValueType.JSONArray,
            nullable: true,
        }),
        number: createColumnFilter({
            expression: SQL.jsonValue(SQL.column(membersTable, 'details'), '$.value.parents[*].address.number'),
            type: SQLModernValueType.JSONArray,
            nullable: true,
        }),
    },
    'parentPhone': createColumnFilter({
        expression: SQL.jsonValue(SQL.column(membersTable, 'details'), '$.value.parents[*].phone'),
        type: SQLModernValueType.JSONArray,
        nullable: true,
    }),
    'unverifiedPhone': createColumnFilter({
        expression: SQL.jsonValue(SQL.column(membersTable, 'details'), '$.value.unverifiedPhones'),
        type: SQLModernValueType.JSONArray,
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
                type: SQLModernValueType.String,
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
            ...baseModernSQLFilterCompilers,
            // Alias for responsibilityId
            id: createColumnFilter({
                expression: SQL.column('member_responsibility_records', 'responsibilityId'),
                type: SQLModernValueType.String,
                nullable: false,
            }),
            responsibilityId: createColumnFilter({
                expression: SQL.column('member_responsibility_records', 'responsibilityId'),
                type: SQLModernValueType.String,
                nullable: false,
            }),
            organizationId: createColumnFilter({
                expression: SQL.column('member_responsibility_records', 'organizationId'),
                type: SQLModernValueType.String,
                nullable: false,
            }),
            startDate: createColumnFilter({
                expression: SQL.column('member_responsibility_records', 'startDate'),
                type: SQLModernValueType.Datetime,
                nullable: false,
            }),
            endDate: createColumnFilter({
                expression: SQL.column('member_responsibility_records', 'endDate'),
                type: SQLModernValueType.Datetime,
                nullable: true,
            }),
            group: {
                ...baseModernSQLFilterCompilers,
                id: createColumnFilter({
                    expression: SQL.column('groups', 'id'),
                    type: SQLModernValueType.String,
                    nullable: false,
                }),
                defaultAgeGroupId: createColumnFilter({
                    expression: SQL.column('groups', 'defaultAgeGroupId'),
                    type: SQLModernValueType.String,
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
            ...baseModernSQLFilterCompilers,
            id: createColumnFilter({
                expression: SQL.column('member_platform_memberships', 'id'),
                type: SQLModernValueType.String,
                nullable: false,
            }),
            membershipTypeId: createColumnFilter({
                expression: SQL.column('member_platform_memberships', 'membershipTypeId'),
                type: SQLModernValueType.String,
                nullable: false,
            }),
            organizationId: createColumnFilter({
                expression: SQL.column('member_platform_memberships', 'organizationId'),
                type: SQLModernValueType.String,
                nullable: false,
            }),
            periodId: createColumnFilter({
                expression: SQL.column('member_platform_memberships', 'periodId'),
                type: SQLModernValueType.String,
                nullable: false,
            }),
            price: createColumnFilter({
                expression: SQL.column('member_platform_memberships', 'price'),
                type: SQLModernValueType.Number,
                nullable: false,
            }),
            priceWithoutDiscount: createColumnFilter({
                expression: SQL.column('member_platform_memberships', 'priceWithoutDiscount'),
                type: SQLModernValueType.Number,
                nullable: false,
            }),
            startDate: createColumnFilter({
                expression: SQL.column('member_platform_memberships', 'startDate'),
                type: SQLModernValueType.Datetime,
                nullable: false,
            }),
            endDate: createColumnFilter({
                expression: SQL.column('member_platform_memberships', 'endDate'),
                type: SQLModernValueType.Datetime,
                nullable: false,
            }),
            expireDate: createColumnFilter({
                expression: SQL.column('member_platform_memberships', 'expireDate'),
                type: SQLModernValueType.Datetime,
                nullable: true,
            }),
            trialUntil: createColumnFilter({
                expression: SQL.column('member_platform_memberships', 'trialUntil'),
                type: SQLModernValueType.Datetime,
                nullable: true,
            }),
            locked: createColumnFilter({
                expression: SQL.column('member_platform_memberships', 'locked'),
                type: SQLModernValueType.Boolean,
                nullable: false,
            }),
            balanceItemId: createColumnFilter({
                expression: SQL.column('member_platform_memberships', 'balanceItemId'),
                type: SQLModernValueType.String,
                nullable: true,
            }),
            generated: createColumnFilter({
                expression: SQL.column('member_platform_memberships', 'generated'),
                type: SQLModernValueType.Boolean,
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
};
