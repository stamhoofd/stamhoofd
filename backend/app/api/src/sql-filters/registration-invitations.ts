import { Group, Member, Organization, RegistrationInvitation } from '@stamhoofd/models';
import type { SQLFilterDefinitions } from '@stamhoofd/sql';
import { baseSQLFilterCompilers, createColumnFilter, createJoinedRelationFilter, SQL, SQLValueType } from '@stamhoofd/sql';
import { SQLTranslatedString } from '../helpers/SQLTranslatedString.js';
import { memberFilterCompilers } from './members.js';

export const memberJoin = SQL.join(Member.table).where(SQL.column(Member.table, 'id'), SQL.column(RegistrationInvitation.table, 'memberId'));

export const groupJoin = SQL.join(Group.table).where(SQL.column(Group.table, 'id'), SQL.column(RegistrationInvitation.table, 'groupId'));

export const organizationJoin = SQL.join(Organization.table).where(SQL.column(Organization.table, 'id'), SQL.column(RegistrationInvitation.table, 'organizationId'));

export const registrationInvitationFilterCompilers: SQLFilterDefinitions = {
    ...baseSQLFilterCompilers,
    id: createColumnFilter({
        expression: SQL.column(RegistrationInvitation.table, 'id'),
        type: SQLValueType.String,
        nullable: false,
    }),
    organizationId: createColumnFilter({
        expression: SQL.column(RegistrationInvitation.table, 'organizationId'),
        type: SQLValueType.String,
        nullable: false,
    }),
    groupId: createColumnFilter({
        expression: SQL.column(RegistrationInvitation.table, 'groupId'),
        type: SQLValueType.String,
        nullable: false,
        // todo?
        // async checkPermission(filter) {
        //     await checkGroupIdFilterAccess(filter, PermissionLevel.Read);
        // },
    }),
    memberId: createColumnFilter({
        expression: SQL.column(RegistrationInvitation.table, 'memberId'),
        type: SQLValueType.String,
        nullable: false,
    }),
    createdAt: createColumnFilter({
        expression: SQL.column(RegistrationInvitation.table, 'createdAt'),
        type: SQLValueType.Datetime,
        nullable: false,
    }),
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
            periodId: createColumnFilter({
                expression: SQL.column('periodId'),
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
            // temporary keep filter for testing
            deletedAt: createColumnFilter({
                expression: SQL.column('groups', 'deletedAt'),
                type: SQLValueType.Datetime,
                nullable: true,
            }),
        },
    ),
};
