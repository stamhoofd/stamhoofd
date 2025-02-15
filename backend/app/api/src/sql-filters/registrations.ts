import { SQLFilterDefinitions, baseSQLFilterCompilers, createSQLColumnFilterCompiler, SQL, createSQLFilterNamespace, createSQLExpressionFilterCompiler, SQLValueType } from '@stamhoofd/sql';

export const registrationFilterCompilers: SQLFilterDefinitions = {
    ...baseSQLFilterCompilers,
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
};
