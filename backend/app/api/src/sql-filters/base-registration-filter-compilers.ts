import { baseSQLFilterCompilers, createSQLColumnFilterCompiler, createSQLExpressionFilterCompiler, createSQLFilterNamespace, createSQLOneToOneRelationFilterCompiler, SQL, SQLFilterDefinitions, SQLValueType } from '@stamhoofd/sql';
import { organizationFilterCompilers } from './organizations';

export const baseRegistrationFilterCompilers: SQLFilterDefinitions = {
    ...baseSQLFilterCompilers,
    id: createSQLColumnFilterCompiler('id'),
    /**
     * @deprecated
     */
    price: createSQLColumnFilterCompiler('price', { nullable: true }),
    /**
     * @deprecated
     */
    pricePaid: createSQLColumnFilterCompiler('pricePaid'),
    canRegister: createSQLColumnFilterCompiler('canRegister'),
    organizationId: createSQLColumnFilterCompiler('organizationId'),
    groupId: createSQLColumnFilterCompiler('groupId'),
    registeredAt: createSQLColumnFilterCompiler('registeredAt', { nullable: true }),
    periodId: createSQLColumnFilterCompiler(SQL.column('registrations', 'periodId')),
    deactivatedAt: createSQLColumnFilterCompiler(SQL.column('registrations', 'deactivatedAt'), { nullable: true }),
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
    organization: createSQLOneToOneRelationFilterCompiler(
        SQL.select()
            .from(SQL.table('organizations'))
            .where(
                SQL.column('organizations', 'id'),
                SQL.column('registrations', 'organizationId'),
            ),
        organizationFilterCompilers,
    ),
};
