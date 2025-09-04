import { Group, Member, Registration } from '@stamhoofd/models';
import { baseSQLFilterCompilers, createColumnFilter, createJoinedRelationFilter, SQL, SQLFilterDefinitions, SQLValueType } from '@stamhoofd/sql';
import { baseRegistrationFilterCompilers } from './base-registration-filter-compilers';
import { memberFilterCompilers } from './members';

export const memberJoin = SQL.join(Member.table).where(SQL.column(Member.table, 'id'), SQL.column(Registration.table, 'memberId'));

const groupJoin = SQL.join(Group.table).where(SQL.column(Group.table, 'id'), SQL.column(Registration.table, 'groupId'));

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
                expression: SQL.jsonValue(SQL.column('groups', 'settings'), '$.value.name'),
                type: SQLValueType.JSONString,
                nullable: false,
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
};
