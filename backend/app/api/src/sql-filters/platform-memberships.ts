import { MemberPlatformMembership } from '@stamhoofd/models';
import type { SQLFilterDefinitions } from '@stamhoofd/sql';
import { baseSQLFilterCompilers, createColumnFilter, createExistsFilter, SQL, SQLValueType } from '@stamhoofd/sql';
import { memberFilterCompilers } from './members.js';
import { organizationFilterCompilers } from './organizations.js';

export const platformMembershipFilterCompilers: SQLFilterDefinitions = {
    ...baseSQLFilterCompilers,
    id: createColumnFilter({
        expression: SQL.column(MemberPlatformMembership.table, 'id'),
        type: SQLValueType.String,
        nullable: false,
    }),
    membershipTypeId: createColumnFilter({
        expression: SQL.column(MemberPlatformMembership.table, 'membershipTypeId'),
        type: SQLValueType.String,
        nullable: false,
    }),
    periodId: createColumnFilter({
        expression: SQL.column(MemberPlatformMembership.table, 'periodId'),
        type: SQLValueType.String,
        nullable: false,
    }),
    startDate: createColumnFilter({
        expression: SQL.column(MemberPlatformMembership.table, 'startDate'),
        type: SQLValueType.Datetime,
        nullable: false,
    }),
    endDate: createColumnFilter({
        expression: SQL.column(MemberPlatformMembership.table, 'endDate'),
        type: SQLValueType.Datetime,
        nullable: false,
    }),
    trialUntil: createColumnFilter({
        expression: SQL.column(MemberPlatformMembership.table, 'trialUntil'),
        type: SQLValueType.Datetime,
        nullable: true,
    }),
    createdAt: createColumnFilter({
        expression: SQL.column(MemberPlatformMembership.table, 'createdAt'),
        type: SQLValueType.Datetime,
        nullable: true,
    }),
    freeAmount: createColumnFilter({
        expression: SQL.column(MemberPlatformMembership.table, 'freeAmount'),
        type: SQLValueType.Number,
        nullable: false,
    }),
    price: createColumnFilter({
        expression: SQL.column(MemberPlatformMembership.table, 'price'),
        type: SQLValueType.Number,
        nullable: false,
    }),
    organization: createExistsFilter(
        SQL.select()
            .from(SQL.table('organizations'))
            .where(
                SQL.column('organizations', 'id'),
                SQL.column(MemberPlatformMembership.table, 'organizationId'),
            ),
        organizationFilterCompilers
    ),
    member: createExistsFilter(
        SQL.select()
            .from(SQL.table('members'))
            .where(
                SQL.column('members', 'id'),
                SQL.column(MemberPlatformMembership.table, 'memberId'),
            ),
        memberFilterCompilers
    )
};
