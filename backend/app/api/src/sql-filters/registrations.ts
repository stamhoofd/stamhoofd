import { Group, Member, Organization, Registration } from '@stamhoofd/models';
import type { SQLFilterDefinitions } from '@stamhoofd/sql';
import { baseSQLFilterCompilers, createColumnFilter, createExistsFilter, createJoinedRelationFilter, SQL, SQLValueType } from '@stamhoofd/sql';
import { SQLTranslatedString } from '../helpers/SQLTranslatedString.js';
import { baseRegistrationFilterCompilers } from './base-registration-filter-compilers.js';
import { memberFilterCompilers } from './members.js';
import { organizationFilterCompilers } from './organizations.js';

export const memberJoin = SQL.join(Member.table).where(SQL.column(Member.table, 'id'), SQL.column(Registration.table, 'memberId'));

export const groupJoin = SQL.join(Group.table).where(SQL.column(Group.table, 'id'), SQL.column(Registration.table, 'groupId'));

export const organizationJoin = SQL.join(Organization.table).where(SQL.column(Organization.table, 'id'), SQL.column(Registration.table, 'organizationId'));

export const registrationFilterCompilers: SQLFilterDefinitions = {
    ...baseSQLFilterCompilers,
    ...baseRegistrationFilterCompilers,
    member: createJoinedRelationFilter(
        memberJoin,
        memberFilterCompilers,
    ),
    group: createJoinedRelationFilter(
        groupJoin,
        {
            ...baseSQLFilterCompilers,
            id: createColumnFilter({
                expression: SQL.column('groupId'),
                type: SQLValueType.String,
                nullable: false,
            }),
            type: createColumnFilter({
                expression: SQL.column('groups', 'type'),
                type: SQLValueType.String,
                nullable: false,
            }),
            name: createColumnFilter({
                expression: new SQLTranslatedString(SQL.column('groups', 'settings'), '$.value.name'),
                type: SQLValueType.String,
                nullable: true,
            }),
            status: createColumnFilter({
                expression: SQL.column('groups', 'status'),
                type: SQLValueType.String,
                nullable: false,
            }),
            defaultAgeGroupId: createColumnFilter({
                expression: SQL.column('groups', 'defaultAgeGroupId'),
                type: SQLValueType.String,
                nullable: true,
            }),
            deletedAt: createColumnFilter({
                expression: SQL.column('groups', 'deletedAt'),
                type: SQLValueType.Datetime,
                nullable: true,
            }),
        },
    ),
    groupPrice: {
        ...baseSQLFilterCompilers,
        id: createColumnFilter({
            expression: SQL.jsonExtract(SQL.column('groupPrice'), '$.value.id'),
            type: SQLValueType.JSONString,
            nullable: false,
        }),
    },
    /**
     * There is a bug in MySQL 8 that is fixed in 9.3
     * where EXISTS (select * from json_table(...)) does not work
     * To fix this, we do a double select with join inside the select
     * It is a bit slower, but it works for now.
     */
    options: createExistsFilter(
        SQL.select()
            .from(SQL.table('registrations', 'innerRegistrations'))
            .join(
                SQL.join(
                    SQL.jsonTable(
                        SQL.jsonExtract(SQL.column('innerRegistrations', 'options'), '$.value'),
                        'options',
                    )
                        .addColumn(
                            'amount',
                            'INT',
                            '$.amount',
                        )
                        .addColumn(
                            'optionId',
                            'TEXT',
                            '$.option.id',
                        )
                        .addColumn(
                            'optionMenuId',
                            'TEXT',
                            '$.optionMenu.id',
                        ),
                ),
            )
            .where(SQL.column('innerRegistrations', 'id'), SQL.column('registrations', 'id')),
        {
            ...baseSQLFilterCompilers,
            amount: createColumnFilter({
                expression: SQL.column('options', 'amount'),
                type: SQLValueType.Number,
                nullable: false,
            }),
            option: {
                ...baseSQLFilterCompilers,
                id: createColumnFilter({
                    expression: SQL.column('options', 'optionId'),
                    type: SQLValueType.String,
                    nullable: false,
                }),
            },
            optionMenu: {
                ...baseSQLFilterCompilers,
                id: createColumnFilter({
                    expression: SQL.column('options', 'optionMenuId'),
                    type: SQLValueType.String,
                    nullable: false,
                }),
            },
        },
    ),
    organization: createJoinedRelationFilter(
        organizationJoin,
        organizationFilterCompilers,
    ),
};
