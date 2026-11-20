import {
    BalanceItem,
    DataRetentionPolicy,
    Member,
    MemberPlatformMembership,
    MemberResponsibilityRecord,
    Order,
    Registration,
    RegistrationPeriod,
    User,
} from '@stamhoofd/models';
import type { SQLWhere } from '@stamhoofd/sql';
import {
    SQL,
    SQLAlias,
    SQLCount,
    SQLMax,
    SQLOrderBy,
    SQLSelectAs,
    SQLWhereSign,
} from '@stamhoofd/sql';
import type { DataRetentionPolicy as DataRetentionPolicyStruct } from '@stamhoofd/structures';
import {
    BalanceItemStatus,
    DATA_RETENTION_LAUNCH_DATE,
    DataRetentionCategory,
    DocumentStatus,
    FixedRetentionAuditLogTypes,
} from '@stamhoofd/structures';

import type { MemberRetentionFacts, OrderRetentionFacts } from './DataRetentionPlanner.js';
import { DataRetentionPolicyIndex } from './DataRetentionPlanner.js';

/**
 * How many items of a category share the same day. start is the latest date of that day, so the group is only due
 * when every item in it is due.
 */
export type DataRetentionDateCount = {
    category: DataRetentionCategory;
    start: Date;
    count: number;
};

/**
 * An account that is not linked to anything anymore. Accounts that are still linked are not in the category at all.
 */
export type AccountRetentionFacts = { organizationId: string | null; start: Date };

/**
 * Collects everything the planner needs, per batch, to avoid a query per member or order.
 * Only the columns the planner uses are selected, so large JSON columns (member details, group settings...) are not decoded.
 *
 * Create one per call: it keeps the end dates of groups between batches.
 *
 * Only the policies are filtered on the tenant. Organizations, periods, members and orders are not, which is only
 * correct while registerTenantCron does not fan out over tenants (see the warning there).
 */
export class DataRetentionFactsLoader {
    private readonly groupEndDates = new Map<string, Date | null>();

    private constructor(
        readonly index: DataRetentionPolicyIndex,
        private readonly periodEndDates: Map<string, Date>,
    ) {}

    /**
     * override replaces the stored policy of one level and category, to count what terms would do before they are saved.
     */
    static async create(
        tenantId: string,
        override?: { organizationId: string | null; policy: DataRetentionPolicyStruct },
    ): Promise<DataRetentionFactsLoader> {
        const platform = new Map<DataRetentionCategory, DataRetentionPolicyStruct>();
        const organizations = new Map<
            string,
            Map<DataRetentionCategory, DataRetentionPolicyStruct>
        >();

        for (const policy of await DataRetentionPolicy.select()
            .where('tenantId', tenantId)
            .fetch()) {
            if (policy.organizationId === null) {
                platform.set(policy.category, policy.getStructure());
                continue;
            }
            const map =
                organizations.get(policy.organizationId) ??
                new Map<DataRetentionCategory, DataRetentionPolicyStruct>();
            map.set(policy.category, policy.getStructure());
            organizations.set(policy.organizationId, map);
        }

        if (override) {
            if (override.organizationId === null) {
                platform.set(override.policy.category, override.policy);
            } else {
                const map =
                    organizations.get(override.organizationId) ??
                    new Map<DataRetentionCategory, DataRetentionPolicyStruct>();
                map.set(override.policy.category, override.policy);
                organizations.set(override.organizationId, map);
            }
        }

        const previousPeriodIds = new Map<string, string | null>();
        const periodEndDates = new Map<string, Date>();
        for (const period of await RegistrationPeriod.select(
            'id',
            'previousPeriodId',
            'endDate',
        ).fetch()) {
            previousPeriodIds.set(period.id, period.previousPeriodId);
            periodEndDates.set(period.id, period.endDate);
        }

        const currentPeriodIds = new Map<string, string>();
        for (const row of await SQL.select(SQL.column('id'), SQL.column('periodId'))
            .from('organizations')
            .fetch()) {
            currentPeriodIds.set(
                row.organizations.id as string,
                row.organizations.periodId as string,
            );
        }

        const index = new DataRetentionPolicyIndex({
            // In userMode organization, a platform term never applies
            platform: STAMHOOFD.userMode === 'platform' ? platform : null,
            organizations,
            getDefault: (organizationId, category) =>
                DataRetentionPolicy.getDefaultStructure(organizationId, category),
            currentPeriodIds,
            previousPeriodIds,
        });
        return new DataRetentionFactsLoader(index, periodEndDates);
    }

    /**
     * The next members after the given id, in id order. Returns null when there are none left.
     */
    async loadMemberBatch(
        afterId: string | null,
        limit: number,
        now: Date,
    ): Promise<{ lastId: string; facts: MemberRetentionFacts[] } | null> {
        const members = await Member.select('id', 'createdAt', 'organizationId', 'anonymizedAt')
            .where('id', SQLWhereSign.Greater, afterId ?? '')
            .orderBy(new SQLOrderBy({ column: SQL.column('id'), direction: 'ASC' }))
            .limit(limit)
            .fetch();

        if (members.length === 0) {
            return null;
        }
        return {
            lastId: members[members.length - 1].id,
            facts: await this.loadMemberFacts(members, now),
        };
    }

    async loadMembersByIds(memberIds: string[], now: Date): Promise<MemberRetentionFacts[]> {
        if (memberIds.length === 0) {
            return [];
        }
        const members = await Member.select('id', 'createdAt', 'organizationId', 'anonymizedAt')
            .where('id', memberIds)
            .fetch();
        return await this.loadMemberFacts(members, now);
    }

    /**
     * The members whose terms this organization decides over, the same ones the nightly count counts for it:
     * every member registered at it. In userMode organization also its members without registrations;
     * within a platform, those only follow the platform.
     */
    async loadMemberIdsOfOrganization(organizationId: string): Promise<string[]> {
        const registered = await SQL.select(SQL.column('memberId'))
            .from('registrations')
            .where('organizationId', organizationId)
            .whereNot('registeredAt', null)
            .fetch();
        const memberIds = new Set(registered.map((row) => row.registrations.memberId as string));

        if (STAMHOOFD.userMode === 'organization') {
            const own = await SQL.select(SQL.column('id'))
                .from('members')
                .where('organizationId', organizationId)
                .fetch();
            for (const row of own) {
                memberIds.add(row.members.id as string);
            }
        }
        return [...memberIds];
    }

    private async loadMemberFacts(members: Member[], now: Date): Promise<MemberRetentionFacts[]> {
        const memberIds = members.map((m) => m.id);
        const facts = new Map<string, MemberRetentionFacts>(
            members.map((member) => [
                member.id,
                {
                    createdAt: member.createdAt,
                    organizationId: member.organizationId,
                    anonymizedAt: member.anonymizedAt,
                    registrations: [],
                    memberships: [],
                    hasActiveResponsibility: false,
                    hasAdminAccount: false,
                    hasOpenBalance: false,
                },
            ]),
        );

        const registrations = await Registration.select(
            'id',
            'memberId',
            'organizationId',
            'groupId',
            'periodId',
            'endDate',
            'deactivatedAt',
        )
            .where('memberId', memberIds)
            .whereNot('registeredAt', null)
            .fetch();
        await this.loadGroupEndDates(registrations.map((r) => r.groupId));

        for (const registration of registrations) {
            const endDate =
                registration.endDate ??
                this.groupEndDates.get(registration.groupId) ??
                this.periodEndDates.get(registration.periodId);
            if (!endDate) {
                continue;
            }
            facts.get(registration.memberId)!.registrations.push({
                organizationId: registration.organizationId,
                periodId: registration.periodId,
                endDate:
                    registration.deactivatedAt && registration.deactivatedAt < endDate
                        ? registration.deactivatedAt
                        : endDate,
            });
        }

        const memberships = await MemberPlatformMembership.select(
            'id',
            'memberId',
            'organizationId',
            'periodId',
            'endDate',
            'locked',
            'balanceItemId',
        )
            .where('memberId', memberIds)
            .where('deletedAt', null)
            .fetch();
        for (const membership of memberships) {
            facts.get(membership.memberId)!.memberships.push({
                organizationId: membership.organizationId,
                periodId: membership.periodId,
                endDate: membership.endDate,
                // Same condition as MembershipCharger uses to find memberships it still has to charge
                isCharged: membership.locked || membership.balanceItemId !== null,
            });
        }

        const responsibilities = await MemberResponsibilityRecord.select('id', 'memberId')
            .where('memberId', memberIds)
            .where(SQL.where('endDate', null).or('endDate', SQLWhereSign.Greater, now))
            .fetch();
        for (const record of responsibilities) {
            facts.get(record.memberId)!.hasActiveResponsibility = true;
        }

        // Only the member's own account: parents' accounts are linked to the member as well
        const users = await User.select('id', 'memberId', 'permissions')
            .where('memberId', memberIds)
            .where('permissions', '!=', null)
            .fetch();
        for (const user of users) {
            if (user.memberId && user.permissions && !user.permissions.isEmpty) {
                facts.get(user.memberId)!.hasAdminAccount = true;
            }
        }

        for (const memberId of await getIdsWithOpenBalance('memberId', memberIds)) {
            facts.get(memberId)!.hasOpenBalance = true;
        }

        return [...facts.values()];
    }

    /**
     * The next orders after the given id that were not anonymized yet, in id order. Returns null when there are none left.
     */
    async loadOrderBatch(
        afterId: string | null,
        limit: number,
        organizationId?: string,
    ): Promise<{ lastId: string; facts: OrderRetentionFacts[] } | null> {
        const query = Order.select('id', 'organizationId', 'createdAt', 'anonymizedAt', 'data')
            .where('id', SQLWhereSign.Greater, afterId ?? '')
            .where('anonymizedAt', null);
        if (organizationId) {
            query.where('organizationId', organizationId);
        }
        const orders = await query
            .orderBy(new SQLOrderBy({ column: SQL.column('id'), direction: 'ASC' }))
            .limit(limit)
            .fetch();

        if (orders.length === 0) {
            return null;
        }

        const withOpenBalance = new Set(
            await getIdsWithOpenBalance(
                'orderId',
                orders.map((o) => o.id),
            ),
        );

        const facts = orders.map((order) => {
            const eventDates = [
                order.data.timeSlot?.date,
                ...order.data.cart.items.map((item) => item.product.dateRange?.endDate),
            ].filter((d) => !!d);

            return {
                organizationId: order.organizationId,
                createdAt: order.createdAt,
                eventDate:
                    eventDates.length > 0
                        ? new Date(Math.max(...eventDates.map((d) => d.getTime())))
                        : null,
                anonymizedAt: order.anonymizedAt,
                hasOpenBalance: withOpenBalance.has(order.id),
            };
        });

        return { lastId: orders[orders.length - 1].id, facts };
    }

    async loadOrganizationBatch(
        afterId: string | null,
        limit: number,
    ): Promise<{ lastId: string; organizationIds: string[] } | null> {
        const rows = await SQL.select(SQL.column('id'))
            .from('organizations')
            .where('id', SQLWhereSign.Greater, afterId ?? '')
            .orderBy(new SQLOrderBy({ column: SQL.column('id'), direction: 'ASC' }))
            .limit(limit)
            .fetch();
        if (rows.length === 0) {
            return null;
        }
        const organizationIds = rows.map((row) => row.organizations.id as string);
        return { lastId: organizationIds[organizationIds.length - 1], organizationIds };
    }

    /**
     * E-mails, documents and audit logs of one organization, or those without an organization.
     * Grouped per day, so this stays one query per category, also for a large organization.
     *
     * Left out: drafts (an e-mail without a send date), and what was deleted by hand, which the cleanup after 30 days removes.
     */
    async loadDateCounts(organizationId: string | null): Promise<DataRetentionDateCount[]> {
        const counts = [
            ...(await countPerDay(
                'emails',
                'sentAt',
                DataRetentionCategory.Emails,
                SQL.where('organizationId', organizationId)
                    .and(SQL.whereNot('sentAt', null))
                    .and('deletedAt', null),
            )),
            ...(await countPerDay(
                'audit_logs',
                'createdAt',
                DataRetentionCategory.AuditLogs,
                SQL.where('organizationId', organizationId).and(
                    SQL.whereNot('type', FixedRetentionAuditLogTypes),
                ),
            )),
        ];

        if (organizationId) {
            counts.push(
                ...(await countPerDay(
                    'documents',
                    'createdAt',
                    DataRetentionCategory.Documents,
                    SQL.where('organizationId', organizationId).and(
                        SQL.whereNot('status', DocumentStatus.Deleted),
                    ),
                )),
            );
        }
        return counts;
    }

    /**
     * The next accounts after the given id, in id order, that are not linked to anything anymore. Returns null when there are none left.
     */
    async loadAccountBatch(
        afterId: string | null,
        limit: number,
        organizationId?: string,
    ): Promise<{ lastId: string; facts: AccountRetentionFacts[] } | null> {
        const query = User.select(
            'id',
            'organizationId',
            'memberId',
            'permissions',
            'lastActiveAt',
            'email',
            'verified',
        ).where('id', SQLWhereSign.Greater, afterId ?? '');
        if (organizationId) {
            query.where('organizationId', organizationId);
        }
        const users = await query
            .orderBy(new SQLOrderBy({ column: SQL.column('id'), direction: 'ASC' }))
            .limit(limit)
            .fetch();

        if (users.length === 0) {
            return null;
        }

        const userIds = users.map((u) => u.id);
        const linked = new Set(
            (
                await SQL.select(SQL.column('usersId'))
                    .from('_members_users')
                    .where('usersId', userIds)
                    .fetch()
            ).map((row) => row._members_users.usersId as string),
        );
        const withOpenBalance = new Set(await getIdsWithOpenBalance('userId', userIds));

        const facts = users
            .filter(
                (user) =>
                    !user.isSystemUser &&
                    !user.isApiUser &&
                    !user.memberId &&
                    !linked.has(user.id) &&
                    (!user.permissions || user.permissions.isEmpty) &&
                    !withOpenBalance.has(user.id),
            )
            .map((user) => ({
                // Within a platform, accounts are shared between organizations, so only the platform term applies
                organizationId: STAMHOOFD.userMode === 'platform' ? null : user.organizationId,
                start:
                    user.lastActiveAt && user.lastActiveAt > DATA_RETENTION_LAUNCH_DATE
                        ? user.lastActiveAt
                        : DATA_RETENTION_LAUNCH_DATE,
            }));

        return { lastId: userIds[userIds.length - 1], facts };
    }

    /**
     * Reads only settings.endDate, because group settings are large.
     */
    private async loadGroupEndDates(groupIds: string[]) {
        const missing = [...new Set(groupIds)].filter((id) => !this.groupEndDates.has(id));
        if (missing.length === 0) {
            return;
        }

        const rows = await SQL.select(
            SQL.column('id'),
            new SQLSelectAs(
                SQL.jsonValue(SQL.column('settings'), '$.value.endDate', 'UNSIGNED'),
                new SQLAlias('groups__endDate'),
            ),
        )
            .from('groups')
            .where('id', missing)
            .fetch();

        for (const id of missing) {
            this.groupEndDates.set(id, null);
        }
        for (const row of rows) {
            const endDate = row.groups.endDate as number | null;
            this.groupEndDates.set(
                row.groups.id as string,
                endDate === null ? null : new Date(endDate),
            );
        }
    }
}

/**
 * Same condition as the outstanding balance in CachedBalance: something is still open or a payment is still pending.
 */
async function getIdsWithOpenBalance(
    column: 'memberId' | 'orderId' | 'userId',
    ids: string[],
): Promise<string[]> {
    if (ids.length === 0) {
        return [];
    }
    const items = await BalanceItem.select('id', column)
        .where(column, ids)
        .whereNot('status', BalanceItemStatus.Hidden)
        .where(
            SQL.where(SQL.column('priceOpen'), SQLWhereSign.NotEqual, 0).or(
                'pricePending',
                SQLWhereSign.NotEqual,
                0,
            ),
        )
        .fetch();
    return items.map((item) => item[column]).filter((id) => id !== null);
}

async function countPerDay(
    table: string,
    column: string,
    category: DataRetentionCategory,
    where: SQLWhere,
): Promise<DataRetentionDateCount[]> {
    const rows = await SQL.select(
        new SQLSelectAs(new SQLMax(SQL.column(column)), new SQLAlias('data__start')),
        new SQLSelectAs(new SQLCount(), new SQLAlias('data__count')),
    )
        .from(table)
        .where(where)
        .groupBy(SQL.cast(SQL.column(column), 'DATE'))
        .fetch();

    return rows.map((row) => ({
        category,
        start: row.data.start as Date,
        count: row.data.count as number,
    }));
}
