import { baseModernSQLFilterCompilers, createColumnFilter, createExistsFilter, SQL, SQLModernFilterDefinitions, SQLModernValueType } from '@stamhoofd/sql';

export const eventFilterCompilers: SQLModernFilterDefinitions = {
    ...baseModernSQLFilterCompilers,
    'id': createColumnFilter({
        expression: SQL.column('id'),
        type: SQLModernValueType.String,
        nullable: false,
    }),
    'name': createColumnFilter({
        expression: SQL.column('name'),
        type: SQLModernValueType.String,
        nullable: false,
    }),
    'organizationId': createColumnFilter({
        expression: SQL.column('organizationId'),
        type: SQLModernValueType.String,
        nullable: true,
    }),
    'startDate': createColumnFilter({
        expression: SQL.column('startDate'),
        type: SQLModernValueType.Datetime,
        nullable: false,
    }),
    'endDate': createColumnFilter({
        expression: SQL.column('endDate'),
        type: SQLModernValueType.Datetime,
        nullable: false,
    }),
    'groupIds': createColumnFilter({
        expression: SQL.jsonValue(SQL.column('meta'), '$.value.groups[*].id'),
        type: SQLModernValueType.JSONArray,
        nullable: true,
    }),
    'groupId': createColumnFilter({
        expression: SQL.column('groupId'),
        type: SQLModernValueType.String,
        nullable: true,
    }),
    'typeId': createColumnFilter({
        expression: SQL.column('typeId'),
        type: SQLModernValueType.String,
        nullable: false,
    }),
    'defaultAgeGroupIds': createColumnFilter({
        expression: SQL.jsonValue(SQL.column('meta'), '$.value.defaultAgeGroupIds'),
        type: SQLModernValueType.JSONArray,
        nullable: true,
    }),
    'organizationTagIds': createColumnFilter({
        expression: SQL.jsonValue(SQL.column('meta'), '$.value.organizationTagIds'),
        type: SQLModernValueType.JSONArray,
        nullable: true,
    }),
    'meta.visible': createColumnFilter({
        expression: SQL.jsonValue(SQL.column('meta'), '$.value.visible'),
        type: SQLModernValueType.JSONBoolean,
        nullable: false,
    }),
    'group': createExistsFilter(
        SQL.select()
            .from(SQL.table('groups'))
            .where(
                SQL.column('id'),
                SQL.column('events', 'groupId'),
            ),
        {
            ...baseModernSQLFilterCompilers,
            organizationId: createColumnFilter({
                expression: SQL.column('organizationId'),
                type: SQLModernValueType.String,
                nullable: false,
            }),
        },
    ),
};
