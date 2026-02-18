import { baseSQLFilterCompilers, createColumnFilter, createExistsFilter, SQL, SQLFilterDefinitions, SQLValueType } from '@stamhoofd/sql';

export const eventFilterCompilers: SQLFilterDefinitions = {
    ...baseSQLFilterCompilers,
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
        expression: SQL.jsonExtract(SQL.column('meta'), '$.value.groups[*].id'),
        type: SQLValueType.JSONArray,
        nullable: true,
    }),
    'groupId': createColumnFilter({
        expression: SQL.column('groupId'),
        type: SQLValueType.String,
        nullable: true,
    }),
    'webshopId': createColumnFilter({
        expression: SQL.column('webshopId'),
        type: SQLValueType.String,
        nullable: true,
    }),
    'typeId': createColumnFilter({
        expression: SQL.column('typeId'),
        type: SQLValueType.String,
        nullable: false,
    }),
    'defaultAgeGroupIds': createColumnFilter({
        expression: SQL.jsonExtract(SQL.column('meta'), '$.value.defaultAgeGroupIds'),
        type: SQLValueType.JSONArray,
        nullable: true,
    }),
    'organizationTagIds': createColumnFilter({
        expression: SQL.jsonExtract(SQL.column('meta'), '$.value.organizationTagIds'),
        type: SQLValueType.JSONArray,
        nullable: true,
    }),
    'minAge': createColumnFilter({
        expression: SQL.jsonExtract(SQL.column('meta'), '$.value.minAge'),
        type: SQLValueType.JSONNumber,
        nullable: true,
    }),
    'maxAge': createColumnFilter({
        expression: SQL.jsonExtract(SQL.column('meta'), '$.value.maxAge'),
        type: SQLValueType.JSONNumber,
        nullable: true,
    }),
    'meta.visible': createColumnFilter({
        expression: SQL.jsonExtract(SQL.column('meta'), '$.value.visible'),
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
            ...baseSQLFilterCompilers,
            organizationId: createColumnFilter({
                expression: SQL.column('organizationId'),
                type: SQLValueType.String,
                nullable: false,
            }),
            status: createColumnFilter({
                expression: SQL.column('status'),
                type: SQLValueType.String,
                nullable: false,
            }),
            registrationStartDate: createColumnFilter({
                expression: SQL.jsonExtract(SQL.column('settings'), '$.value.registrationStartDate'),
                type: SQLValueType.JSONNumber,
                nullable: true,
            }),
            registrationEndDate: createColumnFilter({
                expression: SQL.jsonExtract(SQL.column('settings'), '$.value.registrationEndDate'),
                type: SQLValueType.JSONNumber,
                nullable: true,
            }),
            preRegistrationsDate: createColumnFilter({
                expression: SQL.jsonExtract(SQL.column('settings'), '$.value.preRegistrationsDate'),
                type: SQLValueType.JSONNumber,
                nullable: true,
            }),
        },
    ),
    'webshop': createExistsFilter(
        SQL.select()
            .from(SQL.table('webshops'))
            .where(
                SQL.column('id'),
                SQL.column('events', 'webshopId'),
            ),
        {
            ...baseSQLFilterCompilers,
            status: createColumnFilter({
                expression: SQL.jsonExtract(SQL.column('meta'), '$.value.status'),
                type: SQLValueType.JSONString,
                nullable: false,
            }),
            availableUntil: createColumnFilter({
                expression: SQL.jsonExtract(SQL.column('meta'), '$.value.availableUntil'),
                type: SQLValueType.JSONNumber,
                nullable: true,
            }),
            openAt: createColumnFilter({
                expression: SQL.jsonExtract(SQL.column('meta'), '$.value.openAt'),
                type: SQLValueType.JSONNumber,
                nullable: true,
            }),
        },
    ),
};
