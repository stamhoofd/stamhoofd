import type { Member, Order } from '@stamhoofd/models';
import {
    BalanceItem,
    DataRetentionPolicy,
    Group,
    MemberPlatformMembership,
    MemberResponsibilityRecord,
    Registration,
    RegistrationPeriod,
    User,
} from '@stamhoofd/models';
import { SQL, SQLWhereSign } from '@stamhoofd/sql';
import type {
    DataRetentionCategory,
    DataRetentionPolicy as DataRetentionPolicyStruct,
} from '@stamhoofd/structures';
import { BalanceItemStatus } from '@stamhoofd/structures';

import type { MemberRetentionFacts, OrderRetentionFacts } from './DataRetentionPlanner.js';
import { DataRetentionPolicyIndex } from './DataRetentionPlanner.js';

/**
 * Collects everything the planner needs, per batch, to avoid a query per member or order.
 */
export class DataRetentionFactsLoader {
    static async loadPolicyIndex(
        tenantId: string,
    ): Promise<{ index: DataRetentionPolicyIndex; periodEndDates: Map<string, Date> }> {
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
        for (const period of await RegistrationPeriod.select().fetch()) {
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
        return { index, periodEndDates };
    }

    static async loadMemberFacts(
        members: Member[],
        periodEndDates: Map<string, Date>,
        now: Date,
    ): Promise<Map<string, MemberRetentionFacts>> {
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

        if (memberIds.length === 0) {
            return facts;
        }

        const registrations = await Registration.select()
            .where('memberId', memberIds)
            .whereNot('registeredAt', null)
            .fetch();
        const groups = new Map(
            (await Group.getByIDs(...new Set(registrations.map((r) => r.groupId)))).map((g) => [
                g.id,
                g,
            ]),
        );

        for (const registration of registrations) {
            const endDate =
                registration.endDate ??
                groups.get(registration.groupId)?.settings.endDate ??
                periodEndDates.get(registration.periodId);
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

        const memberships = await MemberPlatformMembership.select()
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

        const responsibilities = await MemberResponsibilityRecord.select()
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
        const users = new Map(
            (
                await User.getByIDs(
                    ...new Set(links.map((l) => l._members_users.usersId as string)),
                )
            ).map((u) => [u.id, u]),
        );
        for (const link of links) {
            const permissions = users.get(link._members_users.usersId as string)?.permissions;
            if (permissions && !permissions.isEmpty) {
                facts.get(link._members_users.membersId as string)!.hasAdminAccount = true;
            }
        }

        for (const memberId of await this.getIdsWithOpenBalance('memberId', memberIds)) {
            facts.get(memberId)!.hasOpenBalance = true;
        }

        return facts;
    }

    static async loadOrderFacts(orders: Order[]): Promise<Map<string, OrderRetentionFacts>> {
        const withOpenBalance = new Set(
            await this.getIdsWithOpenBalance(
                'orderId',
                orders.map((o) => o.id),
            ),
        );

        return new Map(
            orders.map((order) => {
                const eventDates = [
                    order.data.timeSlot?.date,
                    ...order.data.cart.items.map((item) => item.product.dateRange?.endDate),
                ].filter((d) => !!d);

                return [
                    order.id,
                    {
                        organizationId: order.organizationId,
                        createdAt: order.createdAt,
                        eventDate:
                            eventDates.length > 0
                                ? new Date(Math.max(...eventDates.map((d) => d.getTime())))
                                : null,
                        anonymizedAt: order.anonymizedAt,
                        hasOpenBalance: withOpenBalance.has(order.id),
                    },
                ];
            }),
        );
    }

    /**
     * Same condition as the outstanding balance in CachedBalance: something is still open or a payment is still pending.
     */
    private static async getIdsWithOpenBalance(
        column: 'memberId' | 'orderId',
        ids: string[],
    ): Promise<string[]> {
        if (ids.length === 0) {
            return [];
        }
        const items = await BalanceItem.select()
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
}
