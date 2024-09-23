import { SQL, SQLAge, SQLConcat, SQLFilterDefinitions, SQLScalar, SQLValueType, baseSQLFilterCompilers, createSQLColumnFilterCompiler, createSQLExpressionFilterCompiler, createSQLFilterNamespace, createSQLRelationFilterCompiler } from "@stamhoofd/sql";
import { Formatter } from "@stamhoofd/utility";
import { organizationFilterCompilers } from "./organizations";
import { registrationFilterCompilers } from "./registrations";

/**
 * Defines how to filter members in the database from StamhoofdFilter objects
 */
export const memberFilterCompilers: SQLFilterDefinitions = {
    ...baseSQLFilterCompilers,
    id: createSQLColumnFilterCompiler('id'),
    memberNumber: createSQLColumnFilterCompiler('memberNumber'),
    firstName: createSQLColumnFilterCompiler('firstName'),
    lastName: createSQLColumnFilterCompiler('lastName'),
    name: createSQLExpressionFilterCompiler(
        new SQLConcat(
            SQL.column('firstName'),
            new SQLScalar(' '),
            SQL.column('lastName'),
        )
    ),
    age: createSQLExpressionFilterCompiler(
        new SQLAge(SQL.column('birthDay')), 
        {nullable: true}
    ),
    gender: createSQLExpressionFilterCompiler(
        SQL.jsonValue(SQL.column('details'), '$.value.gender'),
        {isJSONValue: true, type: SQLValueType.JSONString}
    ),
    birthDay: createSQLColumnFilterCompiler('birthDay', {
        normalizeValue: (d) => {
            if (typeof d === 'number') {
                const date = new Date(d)
                return Formatter.dateIso(date);
            }
            return d;
        }
    }),
    organizationName: createSQLExpressionFilterCompiler(
        SQL.column('organizations', 'name')
    ),

    email: createSQLExpressionFilterCompiler(
        SQL.jsonValue(SQL.column('details'), '$.value.email'),
        {isJSONValue: true, type: SQLValueType.JSONString}
    ),

    parentEmail: createSQLExpressionFilterCompiler(
        SQL.jsonValue(SQL.column('details'), '$.value.parents[*].email'),
        {isJSONValue: true, isJSONObject: true, type: SQLValueType.JSONString}
    ),

    unverifiedEmail: createSQLExpressionFilterCompiler(
        SQL.jsonValue(SQL.column('details'), '$.value.unverifiedEmails'),
        {isJSONValue: true, isJSONObject: true, type: SQLValueType.JSONString}
    ),

    phone: createSQLExpressionFilterCompiler(
        SQL.jsonValue(SQL.column('details'), '$.value.phone'),
        {isJSONValue: true}
    ),

    parentPhone: createSQLExpressionFilterCompiler(
        SQL.jsonValue(SQL.column('details'), '$.value.parents[*].phone'),
        {isJSONValue: true, isJSONObject: true}
    ),

    unverifiedPhone: createSQLExpressionFilterCompiler(
        SQL.jsonValue(SQL.column('details'), '$.value.unverifiedPhones'),
        {isJSONValue: true, isJSONObject: true}
    ),

    registrations: createSQLRelationFilterCompiler(
        SQL.select()
            .from(
                SQL.table('registrations')
            ).join(
                SQL.join(
                    SQL.table('groups')
                ).where(
                    SQL.column('groups', 'id'),
                    SQL.column('registrations', 'groupId')
                )
            )
            .join(
                SQL.join(
                    SQL.table('organizations')
                ).where(
                    SQL.column('organizations', 'id'),
                    SQL.column('registrations', 'organizationId')
                )
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
                null
            ),
        {
            ...registrationFilterCompilers,
            "organization": createSQLFilterNamespace(organizationFilterCompilers)
        }
    ),

    responsibilities: createSQLRelationFilterCompiler(
        SQL.select()
        .from(
            SQL.table('member_responsibility_records')
        )
        .join(
            SQL.leftJoin(
                SQL.table('groups')
            ).where(
                SQL.column('groups', 'id'),
                SQL.column('member_responsibility_records', 'groupId')
            )
        )
        .where(
            SQL.column('memberId'),
            SQL.column('members', 'id'),
        ),
        {
            ...baseSQLFilterCompilers,
            // Alias for responsibilityId
            "id": createSQLColumnFilterCompiler(SQL.column('member_responsibility_records', 'responsibilityId')),
            "responsibilityId": createSQLColumnFilterCompiler(SQL.column('member_responsibility_records', 'responsibilityId')),
            "organizationId": createSQLColumnFilterCompiler(SQL.column('member_responsibility_records', 'organizationId')),
            "startDate": createSQLColumnFilterCompiler(SQL.column('member_responsibility_records', 'startDate')),
            "endDate": createSQLColumnFilterCompiler(SQL.column('member_responsibility_records', 'endDate')),
            "group": createSQLFilterNamespace({
                ...baseSQLFilterCompilers,
                id: createSQLColumnFilterCompiler(SQL.column('groups', 'id')),
                defaultAgeGroupId: createSQLColumnFilterCompiler(SQL.column('groups', 'defaultAgeGroupId')),
            })
        }
    ),

    platformMemberships: createSQLRelationFilterCompiler(
        SQL.select()
        .from(
            SQL.table('member_platform_memberships')
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
            "id": createSQLColumnFilterCompiler(SQL.column('member_platform_memberships', 'id')),
            "membershipTypeId": createSQLColumnFilterCompiler(SQL.column('member_platform_memberships', 'membershipTypeId')),
            "organizationId": createSQLColumnFilterCompiler(SQL.column('member_platform_memberships', 'organizationId')),
            "periodId": createSQLColumnFilterCompiler(SQL.column('member_platform_memberships', 'periodId')),
            "price": createSQLColumnFilterCompiler(SQL.column('member_platform_memberships', 'price')),
            "invoiceId": createSQLColumnFilterCompiler(SQL.column('member_platform_memberships', 'invoiceId')),
            "startDate": createSQLColumnFilterCompiler(SQL.column('member_platform_memberships', 'startDate')),
            "endDate": createSQLColumnFilterCompiler(SQL.column('member_platform_memberships', 'endDate')),
            "expireDate": createSQLColumnFilterCompiler(SQL.column('member_platform_memberships', 'expireDate')),
        }
    ),

    organizations: createSQLRelationFilterCompiler(
        SQL.select()
        .from(
            SQL.table('registrations')
        ).join(
            SQL.join(
                SQL.table('groups')
            ).where(
                SQL.column('groups', 'id'),
                SQL.column('registrations', 'groupId')
            )
        ).join(
            SQL.join(
                SQL.table('organizations')
            ).where(
                SQL.column('organizations', 'id'),
                SQL.column('registrations', 'organizationId')
            )
        ).where(
            SQL.column('memberId'),
            SQL.column('members', 'id'),
        ).whereNot(
            SQL.column('registeredAt'),
            null,
        ).where(
            SQL.column('groups', 'deletedAt'),
            null
        ),
        organizationFilterCompilers
    ),
}
