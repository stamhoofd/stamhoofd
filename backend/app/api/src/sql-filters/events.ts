import { baseModernSQLFilterCompilers, createColumnFilter, createExistsFilter, SQL, SQLModernFilterDefinitions, SQLValueType } from '@stamhoofd/sql';

export const eventFilterCompilers: SQLModernFilterDefinitions = {
    ...baseModernSQLFilterCompilers,
    'id': createColumnFilter({
        expression: SQL.column('id'),
        type: SQLValueType.String,
        nullable: false,
    }),
    'name': createColumnFilter({
        expression: SQL.column('name'),
        type: SQLValueType.String,
        nullable: false,
    }),
    'organizationId': createColumnFilter({
        expression: SQL.column('organizationId'),
        type: SQLValueType.String,
        nullable: true,
    }),
    'startDate': createColumnFilter({
        expression: SQL.column('startDate'),
        type: SQLValueType.Datetime,
        nullable: false,
    }),
    'endDate': createColumnFilter({
        expression: SQL.column('endDate'),
        type: SQLValueType.Datetime,
        nullable: false,
    }),
    'groupIds': createColumnFilter({
        expression: SQL.jsonValue(SQL.column('meta'), '$.value.groups[*].id'),
        type: SQLValueType.JSONArray,
        nullable: true,
    }),
    'groupId': createColumnFilter({
        expression: SQL.column('groupId'),
        type: SQLValueType.String,
        nullable: true,
    }),
    'typeId': createColumnFilter({
        expression: SQL.column('typeId'),
        type: SQLValueType.String,
        nullable: false,
    }),
    'defaultAgeGroupIds': createColumnFilter({
        expression: SQL.jsonValue(SQL.column('meta'), '$.value.defaultAgeGroupIds'),
        type: SQLValueType.JSONArray,
        nullable: true,
    }),
    'organizationTagIds': createColumnFilter({
        expression: SQL.jsonValue(SQL.column('meta'), '$.value.organizationTagIds'),
        type: SQLValueType.JSONArray,
        nullable: true,
    }),
    'meta.visible': createColumnFilter({
        expression: SQL.jsonValue(SQL.column('meta'), '$.value.visible'),
        type: SQLValueType.JSONBoolean,
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
                type: SQLValueType.String,
                nullable: false,
            }),
        },
    ),
};
