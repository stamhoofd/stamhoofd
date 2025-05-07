import { SimpleError } from '@simonbackx/simple-errors';
import { Member, Registration } from '@stamhoofd/models';
import { baseSQLFilterCompilers, createSQLColumnFilterCompiler, createSQLExpressionFilterCompiler, createSQLFilterNamespace, createSQLJoinedRelationFilterCompiler, createSQLRelationFilterCompiler, SQL, SQLAge, SQLConcat, SQLFilterDefinitions, SQLScalar, SQLValueType } from '@stamhoofd/sql';
import { AccessRight } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Context } from '../helpers/Context';
import { organizationFilterCompilers } from './organizations';

export const memberJoin = SQL.join(Member.table).where(SQL.column(Member.table, 'id'), SQL.column(Registration.table, 'memberId'));

const baseRegistrationFilterCompilers: SQLFilterDefinitions = {
    ...baseSQLFilterCompilers,
    id: createSQLColumnFilterCompiler('id'),
    price: createSQLColumnFilterCompiler('price', { nullable: true }),
    pricePaid: createSQLColumnFilterCompiler('pricePaid'),
    canRegister: createSQLColumnFilterCompiler('canRegister'),
    organizationId: createSQLColumnFilterCompiler('organizationId'),
    groupId: createSQLColumnFilterCompiler('groupId'),
    registeredAt: createSQLColumnFilterCompiler('registeredAt', { nullable: true }),
    periodId: createSQLColumnFilterCompiler(SQL.column('registrations', 'periodId')),

    group: createSQLFilterNamespace({
        ...baseSQLFilterCompilers,
        id: createSQLColumnFilterCompiler('groupId'),
        name: createSQLExpressionFilterCompiler(
            SQL.jsonValue(SQL.column('groups', 'settings'), '$.value.name'),
            { isJSONValue: true, type: SQLValueType.JSONString },
        ),
        status: createSQLExpressionFilterCompiler(
            SQL.column('groups', 'status'),
            { isJSONValue: true, type: SQLValueType.JSONString },
        ),
        defaultAgeGroupId: createSQLColumnFilterCompiler(SQL.column('groups', 'defaultAgeGroupId'), { nullable: true }),
    }),
    organization: createSQLFilterNamespace(organizationFilterCompilers),
};

export const registrationFilterCompilers: SQLFilterDefinitions = {
    ...baseSQLFilterCompilers,
    ...baseRegistrationFilterCompilers,
    member: createSQLJoinedRelationFilterCompiler(
        memberJoin,
        {
            ...baseSQLFilterCompilers,
            'id': createSQLColumnFilterCompiler(SQL.column(SQL.table(Member.table), 'id')),
            'memberNumber': createSQLColumnFilterCompiler(SQL.column(SQL.table(Member.table), 'memberNumber')),
            'firstName': createSQLColumnFilterCompiler(SQL.column(SQL.table(Member.table), 'firstName')),
            'lastName': createSQLColumnFilterCompiler(SQL.column(SQL.table(Member.table), 'lastName')),
            'name': createSQLExpressionFilterCompiler(
                new SQLConcat(
                    SQL.column(SQL.table(Member.table), 'firstName'),
                    new SQLScalar(' '),
                    SQL.column(SQL.table(Member.table), 'lastName'),
                ),
            ),
            'age': createSQLExpressionFilterCompiler(
                new SQLAge(SQL.column(SQL.table(Member.table), 'birthDay')),
                { nullable: true },
            ),
            'gender': createSQLExpressionFilterCompiler(
                SQL.jsonValue(SQL.column(SQL.table(Member.table), 'details'), '$.value.gender'),
                { isJSONValue: true, type: SQLValueType.JSONString },
            ),

            'birthDay': createSQLColumnFilterCompiler(SQL.column(SQL.table(Member.table), 'birthDay'), {
                normalizeValue: (d) => {
                    if (typeof d === 'number') {
                        const date = new Date(d);
                        return Formatter.dateIso(date);
                    }
                    return d;
                },
            }),

            // todo?
            'organizationName': createSQLExpressionFilterCompiler(
                SQL.column('organizations', 'name'),
            ),

            'details.requiresFinancialSupport': createSQLExpressionFilterCompiler(
                SQL.jsonValue(SQL.column(SQL.table(Member.table), 'details'), '$.value.requiresFinancialSupport.value'),
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
                            human: $t(`64d658fa-0727-4924-9448-b243fe8e10a1`),
                            statusCode: 400,
                        });
                    }
                } },
            ),

            'email': createSQLExpressionFilterCompiler(
                SQL.jsonValue(SQL.column(SQL.table(Member.table), 'details'), '$.value.email'),
                { isJSONValue: true, type: SQLValueType.JSONString },
            ),

            'parentEmail': createSQLExpressionFilterCompiler(
                SQL.jsonValue(SQL.column(SQL.table(Member.table), 'details'), '$.value.parents[*].email'),
                { isJSONValue: true, isJSONObject: true, type: SQLValueType.JSONString },
            ),

            'details.parents[0]': createSQLFilterNamespace({
                name: createSQLExpressionFilterCompiler(
                    new SQLConcat(
                        SQL.jsonUnquotedValue(SQL.column(SQL.table(Member.table), 'details'), '$.value.parents[0].firstName'),
                        new SQLScalar(' '),
                        SQL.jsonUnquotedValue(SQL.column(SQL.table(Member.table), 'details'), '$.value.parents[0].lastName'),
                    ),
                    { isJSONValue: true, isJSONObject: false, type: SQLValueType.JSONString },
                ),
            }),

            'details.parents[1]': createSQLFilterNamespace({
                name: createSQLExpressionFilterCompiler(
                    new SQLConcat(
                        SQL.jsonUnquotedValue(SQL.column(SQL.table(Member.table), 'details'), '$.value.parents[1].firstName'),
                        new SQLScalar(' '),
                        SQL.jsonUnquotedValue(SQL.column(SQL.table(Member.table), 'details'), '$.value.parents[1].lastName'),
                    ),
                    { isJSONValue: true, isJSONObject: false, type: SQLValueType.JSONString },
                ),
            }),

            'unverifiedEmail': createSQLExpressionFilterCompiler(
                SQL.jsonValue(SQL.column(SQL.table(Member.table), 'details'), '$.value.unverifiedEmails'),
                { isJSONValue: true, isJSONObject: true, type: SQLValueType.JSONString },
            ),

            'phone': createSQLExpressionFilterCompiler(
                SQL.jsonValue(SQL.column(SQL.table(Member.table), 'details'), '$.value.phone'),
                { isJSONValue: true },
            ),

            'details.address': createSQLFilterNamespace({
                city: createSQLExpressionFilterCompiler(
                    SQL.jsonValue(SQL.column(SQL.table(Member.table), 'details'), '$.value.address.city'),
                    { isJSONValue: true, type: SQLValueType.JSONString },
                ),
                postalCode: createSQLExpressionFilterCompiler(
                    SQL.jsonValue(SQL.column(SQL.table(Member.table), 'details'), '$.value.address.postalCode'),
                    { isJSONValue: true, type: SQLValueType.JSONString },
                ),
                street: createSQLExpressionFilterCompiler(
                    SQL.jsonValue(SQL.column(SQL.table(Member.table), 'details'), '$.value.address.street'),
                    { isJSONValue: true, type: SQLValueType.JSONString },
                ),
                number: createSQLExpressionFilterCompiler(
                    SQL.jsonValue(SQL.column(SQL.table(Member.table), 'details'), '$.value.address.number'),
                    { isJSONValue: true, type: SQLValueType.JSONString },
                ),
            }),

            'details.parents[*].address': createSQLFilterNamespace({
                city: createSQLExpressionFilterCompiler(
                    SQL.jsonValue(SQL.column(SQL.table(Member.table), 'details'), '$.value.parents[*].address.city'),
                    { isJSONValue: true, isJSONObject: true },
                ),
                postalCode: createSQLExpressionFilterCompiler(
                    SQL.jsonValue(SQL.column(SQL.table(Member.table), 'details'), '$.value.parents[*].address.postalCode'),
                    { isJSONValue: true, isJSONObject: true },
                ),
                street: createSQLExpressionFilterCompiler(
                    SQL.jsonValue(SQL.column(SQL.table(Member.table), 'details'), '$.value.parents[*].address.street'),
                    { isJSONValue: true, isJSONObject: true },
                ),
                number: createSQLExpressionFilterCompiler(
                    SQL.jsonValue(SQL.column(SQL.table(Member.table), 'details'), '$.value.parents[*].address.number'),
                    { isJSONValue: true, isJSONObject: true },
                ),
            }),

            'parentPhone': createSQLExpressionFilterCompiler(
                SQL.jsonValue(SQL.column(SQL.table(Member.table), 'details'), '$.value.parents[*].phone'),
                { isJSONValue: true, isJSONObject: true },
            ),

            'unverifiedPhone': createSQLExpressionFilterCompiler(
                SQL.jsonValue(SQL.column(SQL.table(Member.table), 'details'), '$.value.unverifiedPhones'),
                { isJSONValue: true, isJSONObject: true },
            ),

            // todo?
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
                baseRegistrationFilterCompilers,
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
        }),
};
