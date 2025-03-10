import { SimpleError } from '@simonbackx/simple-errors';
import { SQL, SQLAge, SQLConcat, SQLFilterDefinitions, SQLScalar, SQLValueType, baseSQLFilterCompilers, createSQLColumnFilterCompiler, createSQLExpressionFilterCompiler, createSQLFilterNamespace, createSQLRelationFilterCompiler } from '@stamhoofd/sql';
import { AccessRight } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Context } from '../helpers/Context';
import { organizationFilterCompilers } from './organizations';
import { registrationFilterCompilers } from './registrations';

/**
 * Defines how to filter members in the database from StamhoofdFilter objects
 */
export const memberFilterCompilers: SQLFilterDefinitions = {
    ...baseSQLFilterCompilers,
    'id': createSQLColumnFilterCompiler('id'),
    'memberNumber': createSQLColumnFilterCompiler('memberNumber'),
    'firstName': createSQLColumnFilterCompiler('firstName'),
    'lastName': createSQLColumnFilterCompiler('lastName'),
    'name': createSQLExpressionFilterCompiler(
        new SQLConcat(
            SQL.column('firstName'),
            new SQLScalar(' '),
            SQL.column('lastName'),
        ),
    ),
    'age': createSQLExpressionFilterCompiler(
        new SQLAge(SQL.column('birthDay')),
        { nullable: true },
    ),
    'gender': createSQLExpressionFilterCompiler(
        SQL.jsonValue(SQL.column('details'), '$.value.gender'),
        { isJSONValue: true, type: SQLValueType.JSONString },
    ),

    'birthDay': createSQLColumnFilterCompiler('birthDay', {
        normalizeValue: (d) => {
            if (typeof d === 'number') {
                const date = new Date(d);
                return Formatter.dateIso(date);
            }
            return d;
        },
    }),

    'organizationName': createSQLExpressionFilterCompiler(
        SQL.column('organizations', 'name'),
    ),

    'details.requiresFinancialSupport': createSQLExpressionFilterCompiler(
        SQL.jsonValue(SQL.column('details'), '$.value.requiresFinancialSupport.value'),
        { isJSONValue: true, type: SQLValueType.JSONBoolean, checkPermission: async () => {
            const organization = Context.organization;
            if (!organization) {
                return;
            }

            const permissions = await Context.auth.getOrganizationPermissions(organization);

            if (!permissions || !permissions.hasAccessRight(AccessRight.MemberReadFinancialData)) {
                throw new SimpleError({
                    code: 'permission_denied',
                    message: 'No permissions for financial support filter (organization scope).',
                    human: 'Je hebt geen toegangsrechten om deze filter te gebruiken.',
                    statusCode: 400,
                });
            }
        } },
    ),

    'email': createSQLExpressionFilterCompiler(
        SQL.jsonValue(SQL.column('details'), '$.value.email'),
        { isJSONValue: true, type: SQLValueType.JSONString },
    ),

    'parentEmail': createSQLExpressionFilterCompiler(
        SQL.jsonValue(SQL.column('details'), '$.value.parents[*].email'),
        { isJSONValue: true, isJSONObject: true, type: SQLValueType.JSONString },
    ),

    'details.parents[0]': createSQLFilterNamespace({
        name: createSQLExpressionFilterCompiler(
            new SQLConcat(
                SQL.jsonUnquotedValue(SQL.column('details'), '$.value.parents[0].firstName'),
                new SQLScalar(' '),
                SQL.jsonUnquotedValue(SQL.column('details'), '$.value.parents[0].lastName'),
            ),
            { isJSONValue: true, isJSONObject: false, type: SQLValueType.JSONString },
        ),
    }),

    'details.parents[1]': createSQLFilterNamespace({
        name: createSQLExpressionFilterCompiler(
            new SQLConcat(
                SQL.jsonUnquotedValue(SQL.column('details'), '$.value.parents[1].firstName'),
                new SQLScalar(' '),
                SQL.jsonUnquotedValue(SQL.column('details'), '$.value.parents[1].lastName'),
            ),
            { isJSONValue: true, isJSONObject: false, type: SQLValueType.JSONString },
        ),
    }),

    'unverifiedEmail': createSQLExpressionFilterCompiler(
        SQL.jsonValue(SQL.column('details'), '$.value.unverifiedEmails'),
        { isJSONValue: true, isJSONObject: true, type: SQLValueType.JSONString },
    ),

    'phone': createSQLExpressionFilterCompiler(
        SQL.jsonValue(SQL.column('details'), '$.value.phone'),
        { isJSONValue: true },
    ),

    'details.address': createSQLFilterNamespace({
        city: createSQLExpressionFilterCompiler(
            SQL.jsonValue(SQL.column('details'), '$.value.address.city'),
            { isJSONValue: true, type: SQLValueType.JSONString },
        ),
        postalCode: createSQLExpressionFilterCompiler(
            SQL.jsonValue(SQL.column('details'), '$.value.address.postalCode'),
            { isJSONValue: true, type: SQLValueType.JSONString },
        ),
        street: createSQLExpressionFilterCompiler(
            SQL.jsonValue(SQL.column('details'), '$.value.address.street'),
            { isJSONValue: true, type: SQLValueType.JSONString },
        ),
        number: createSQLExpressionFilterCompiler(
            SQL.jsonValue(SQL.column('details'), '$.value.address.number'),
            { isJSONValue: true, type: SQLValueType.JSONString },
        ),
    }),

    'details.parents[*].address': createSQLFilterNamespace({
        city: createSQLExpressionFilterCompiler(
            SQL.jsonValue(SQL.column('details'), '$.value.parents[*].address.city'),
            { isJSONValue: true, isJSONObject: true },
        ),
        postalCode: createSQLExpressionFilterCompiler(
            SQL.jsonValue(SQL.column('details'), '$.value.parents[*].address.postalCode'),
            { isJSONValue: true, isJSONObject: true },
        ),
        street: createSQLExpressionFilterCompiler(
            SQL.jsonValue(SQL.column('details'), '$.value.parents[*].address.street'),
            { isJSONValue: true, isJSONObject: true },
        ),
        number: createSQLExpressionFilterCompiler(
            SQL.jsonValue(SQL.column('details'), '$.value.parents[*].address.number'),
            { isJSONValue: true, isJSONObject: true },
        ),
    }),

    'parentPhone': createSQLExpressionFilterCompiler(
        SQL.jsonValue(SQL.column('details'), '$.value.parents[*].phone'),
        { isJSONValue: true, isJSONObject: true },
    ),

    'unverifiedPhone': createSQLExpressionFilterCompiler(
        SQL.jsonValue(SQL.column('details'), '$.value.unverifiedPhones'),
        { isJSONValue: true, isJSONObject: true },
    ),

    'registrations': createSQLRelationFilterCompiler(
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
            .join(
                SQL.join(
                    SQL.table('organizations'),
                ).where(
                    SQL.column('organizations', 'id'),
                    SQL.column('registrations', 'organizationId'),
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
            ...registrationFilterCompilers,
            organization: createSQLFilterNamespace(organizationFilterCompilers),
        },
    ),

    'responsibilities': createSQLRelationFilterCompiler(
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
            id: createSQLColumnFilterCompiler(SQL.column('member_responsibility_records', 'responsibilityId')),
            responsibilityId: createSQLColumnFilterCompiler(SQL.column('member_responsibility_records', 'responsibilityId')),
            organizationId: createSQLColumnFilterCompiler(SQL.column('member_responsibility_records', 'organizationId')),
            startDate: createSQLColumnFilterCompiler(SQL.column('member_responsibility_records', 'startDate')),
            endDate: createSQLColumnFilterCompiler(SQL.column('member_responsibility_records', 'endDate')),
            group: createSQLFilterNamespace({
                ...baseSQLFilterCompilers,
                id: createSQLColumnFilterCompiler(SQL.column('groups', 'id')),
                defaultAgeGroupId: createSQLColumnFilterCompiler(SQL.column('groups', 'defaultAgeGroupId')),
            }),
            organization: createSQLFilterNamespace(organizationFilterCompilers),
        },
    ),

    'platformMemberships': createSQLRelationFilterCompiler(
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
            id: createSQLColumnFilterCompiler(SQL.column('member_platform_memberships', 'id')),
            membershipTypeId: createSQLColumnFilterCompiler(SQL.column('member_platform_memberships', 'membershipTypeId')),
            organizationId: createSQLColumnFilterCompiler(SQL.column('member_platform_memberships', 'organizationId')),
            periodId: createSQLColumnFilterCompiler(SQL.column('member_platform_memberships', 'periodId')),
            price: createSQLColumnFilterCompiler(SQL.column('member_platform_memberships', 'price')),
            priceWithoutDiscount: createSQLColumnFilterCompiler(SQL.column('member_platform_memberships', 'priceWithoutDiscount')),
            startDate: createSQLColumnFilterCompiler(SQL.column('member_platform_memberships', 'startDate')),
            endDate: createSQLColumnFilterCompiler(SQL.column('member_platform_memberships', 'endDate')),
            expireDate: createSQLColumnFilterCompiler(SQL.column('member_platform_memberships', 'expireDate')),
            trialUntil: createSQLColumnFilterCompiler(SQL.column('member_platform_memberships', 'trialUntil')),
            locked: createSQLColumnFilterCompiler(SQL.column('member_platform_memberships', 'locked')),
            balanceItemId: createSQLColumnFilterCompiler(SQL.column('member_platform_memberships', 'balanceItemId')),
            generated: createSQLColumnFilterCompiler(SQL.column('member_platform_memberships', 'generated')),
        },
    ),

    'organizations': createSQLRelationFilterCompiler(
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
