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
import { SQL, SQLAlias, SQLOrderBy, SQLSelectAs, SQLWhereSign } from '@stamhoofd/sql';
import type {
    DataRetentionCategory,
    DataRetentionPolicy as DataRetentionPolicyStruct,
} from '@stamhoofd/structures';
import { BalanceItemStatus } from '@stamhoofd/structures';

import type { MemberRetentionFacts, OrderRetentionFacts } from './DataRetentionPlanner.js';
import { DataRetentionPolicyIndex } from './DataRetentionPlanner.js';

/**
 * Collects everything the planner needs, per batch, to avoid a query per member or order.
 * Only the columns the planner uses are selected, so large JSON columns (member details, group settings...) are not decoded.
 *
 * Create one per call: it keeps the end dates of groups between batches.
 */
export class DataRetentionFactsLoader {
    private readonly groupEndDates = new Map<string, Date | null>();

    private constructor(
        readonly index: DataRetentionPolicyIndex,
        private readonly periodEndDates: Map<string, Date>,
    ) {}

    static async create(tenantId: string): Promise<DataRetentionFactsLoader> {
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

        const links = await SQL.select(SQL.column('membersId'), SQL.column('usersId'))
            .from('_members_users')
            .where('membersId', memberIds)
            .fetch();
        const userIds = [...new Set(links.map((l) => l._members_users.usersId as string))];
        const users =
            userIds.length === 0
                ? new Map<string, User>()
                : new Map(
                      (await User.select('id', 'permissions').where('id', userIds).fetch()).map(
                          (u) => [u.id, u],
                      ),
                  );
        for (const link of links) {
            const permissions = users.get(link._members_users.usersId as string)?.permissions;
            if (permissions && !permissions.isEmpty) {
                facts.get(link._members_users.membersId as string)!.hasAdminAccount = true;
            }
        }

        for (const memberId of await getIdsWithOpenBalance('memberId', memberIds)) {
            facts.get(memberId)!.hasOpenBalance = true;
        }

        return { lastId: memberIds[memberIds.length - 1], facts: [...facts.values()] };
    }

    /**
     * The next orders after the given id that were not anonymized yet, in id order. Returns null when there are none left.
     */
    async loadOrderBatch(
        afterId: string | null,
        limit: number,
    ): Promise<{ lastId: string; facts: OrderRetentionFacts[] } | null> {
        const orders = await Order.select(
            'id',
            'organizationId',
            'createdAt',
            'anonymizedAt',
            'data',
        )
            .where('id', SQLWhereSign.Greater, afterId ?? '')
            .where('anonymizedAt', null)
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
    column: 'memberId' | 'orderId',
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
