import { Model } from '@simonbackx/simple-database';
import { SimpleError } from '@simonbackx/simple-errors';
import { logger } from '@simonbackx/simple-logging';
import { BalanceItem, Group, Member, MemberPlatformMembership, Organization, Platform, Registration, RegistrationPeriod } from '@stamhoofd/models';
import { QueueHandler } from '@stamhoofd/queues';
import { SQL, SQLWhereSign } from '@stamhoofd/sql';
import { AuditLogSource, PlatformMembershipTypeBehaviour } from '@stamhoofd/structures';
import { Formatter, sleep, Sorter } from '@stamhoofd/utility';
import { AuditLogService } from './AuditLogService.js';
import { MemberNumberService } from './MemberNumberService.js';

export class PlatformMembershipService {
    static listen() {
        if (STAMHOOFD.userMode === 'organization') {
            return;
        }

        // Listen for group changes
        Model.modelEventBus.addListener(this, async (event) => {
            if (event.model instanceof Group) {
                // Check if group has been deleted
                if (event.type === 'deleted' || (event.type === 'updated' && (event.changedFields['deletedAt'] !== undefined || event.changedFields['defaultAgeGroupId'] !== undefined))) {
                    PlatformMembershipService.updateMembershipsForGroupId(event.model.id);
                }
                return;
            }

            if (event.model instanceof RegistrationPeriod) {
                if (event.type === 'updated' && event.changedFields['locked'] !== undefined && event.model.locked === true) {
                    PlatformMembershipService.setMembershipsLockedForRegistrationPeriodId(event.model.id);
                }
            }
        });
    }

    static async updateAll() {
        if (STAMHOOFD.userMode === 'organization') {
            return;
        }

        console.log('Scheduling updateAllMemberships');

        let c = 0;
        let id: string = '';
        const tag = 'updateAllMemberships';
        const batch = 100;

        QueueHandler.cancel(tag);

        await QueueHandler.schedule(tag, async () => {
            console.log('Starting updateAllMemberships');
            await logger.setContext({ tags: ['silent-seed', 'seed'] }, async () => {
                while (true) {
                    await sleep(200);
                    const rawMembers = await Member.where({
                        id: {
                            value: id,
                            sign: '>',
                        },
                    }, { limit: batch, sort: ['id'] });

                    if (rawMembers.length === 0) {
                        break;
                    }

                    const promises: Promise<any>[] = [];

                    for (const member of rawMembers) {
                        promises.push((async () => {
                            await PlatformMembershipService.updateMembershipsForId(member.id, true);
                            c++;

                            if (c % 10000 === 0) {
                                process.stdout.write(c + ' members updated\n');
                            }
                        })());
                    }

                    await Promise.all(promises);
                    id = rawMembers[rawMembers.length - 1].id;

                    if (rawMembers.length < batch) {
                        break;
                    }
                }
            });
        });
    }

    static setMembershipsLockedForRegistrationPeriodId(periodId: string) {
        if (STAMHOOFD.userMode === 'organization') {
            return;
        }

        QueueHandler.schedule('bulk-lock-memberships', async () => {
            console.log('Bulk locking memberships for period id ', periodId);

            await MemberPlatformMembership.update()
                .set('locked', true)
                .where('periodId', periodId)
                .update();

            console.log(`Locked memberships for period id ${periodId}`);
        }).catch((e) => {
            console.error('Failed to lock memberships for period id ', periodId, e);
        });
    }

    static updateMembershipsForGroupId(id: string) {
        if (STAMHOOFD.userMode === 'organization') {
            return;
        }
        QueueHandler.schedule('bulk-update-memberships', async () => {
            console.log('Bulk updating memberships for group id ', id);

            // Get all members that are registered in this group
            const memberIds = (await SQL.select(
                SQL.column('members', 'id'),
            )
                .from(SQL.table(Member.table))
                .join(
                    SQL.leftJoin(
                        SQL.table(Registration.table),
                    ).where(
                        SQL.column(Registration.table, 'memberId'),
                        SQL.column(Member.table, 'id'),
                    ),
                ).where(
                    SQL.column(Registration.table, 'groupId'),
                    id,
                ).fetch()).flatMap(r => (r.members && (typeof r.members.id) === 'string') ? [r.members.id as string] : []);

            for (const id of memberIds) {
                await PlatformMembershipService.updateMembershipsForId(id);
            }
        }).catch((e) => {
            console.error('Failed to update memberships for group id ', id, e);
        });
    }

    static async updateMembershipsForId(id: string, silent = false) {
        if (STAMHOOFD.userMode === 'organization') {
            return;
        }

        return await AuditLogService.setContext({ source: AuditLogSource.System }, async () => {
            await QueueHandler.schedule('updateMemberships-' + id, async function (this: undefined) {
                if (!silent) {
                    console.log('update memberships for id ', id);
                }

                const me = await Member.getByIdWithRegistrationsAndGroups(id);
                if (!me) {
                    if (!silent) {
                        console.log('Skipping automatic membership for: ' + id, ' - member not found');
                    }
                    return;
                }
                if (me.organizationId) {
                    if (!silent) {
                        console.warn('Cannot update members for a member with organization set', me.id);
                    }
                    return;
                }

                const platform = await Platform.getSharedStruct();
                const periods = await RegistrationPeriod.select()
                    .where('locked', false)
                    .where('organizationId', null)
                    .where('endDate', SQLWhereSign.GreaterEqual, new Date()) // Avoid updating the price of past periods that were not yet locked
                    .fetch();

                if (periods.length === 0) {
                    if (!silent) {
                        console.warn('No periods found for member ' + me.id);
                    }
                }
                const types = platform.config.membershipTypes.filter(m => m.behaviour === PlatformMembershipTypeBehaviour.Period).map(m => m.id);
                if (types.length === 0) {
                    if (!silent && STAMHOOFD.environment !== 'test') {
                        console.warn('No membership types found for memberships');
                    }
                    return;
                }

                // Every (not-locked) period can have a generated membership
                for (const period of periods) {
                    const registrations = me.registrations.filter(r => r.group.periodId === period.id && r.registeredAt && !r.deactivatedAt);

                    const defaultMemberships = registrations.flatMap((r) => {
                        if (!r.group.defaultAgeGroupId) {
                            return [];
                        }
                        const defaultAgeGroup = platform.config.defaultAgeGroups.find(g => g.id === r.group.defaultAgeGroupId);
                        if (!defaultAgeGroup || !defaultAgeGroup.defaultMembershipTypeId) {
                            return [];
                        }

                        const defaultMembership = platform.config.membershipTypes.find(m => m.id === defaultAgeGroup.defaultMembershipTypeId);
                        if (!defaultMembership) {
                            return [];
                        }
                        const periodConfig = defaultMembership.periods.get(period.id);

                        if (periodConfig === undefined) {
                            console.warn('Found default membership without period configuration', defaultMembership.id, period.id);
                            return [];
                        }

                        return [{
                            registration: r,
                            membership: defaultMembership,
                        }];
                    });

                    // Get active memberships for this member that
                    const activeMemberships = await MemberPlatformMembership.where({
                        memberId: me.id,
                        periodId: period.id,
                        membershipTypeId: { sign: 'IN', value: types },
                        deletedAt: null,
                    });

                    if (defaultMemberships.length === 0) {
                        // Stop all active memberships that were added automatically
                        for (const membership of activeMemberships) {
                            if (membership.canDelete() && membership.generated) {
                                if (!silent) {
                                    console.log('Removing membership because no longer registered member and not yet invoiced for: ' + me.id + ' - membership ' + membership.id);
                                }
                                await membership.doDelete();
                            }
                        }

                        if (!silent) {
                            console.log('Skipping automatic membership for: ' + me.id, ' - no default memberships found');
                        }
                        continue;
                    }

                    // Add the cheapest available membership
                    const organizations = await Organization.getByIDs(...Formatter.uniqueArray(defaultMemberships.map(m => m.registration.organizationId)));

                    const defaultMembershipsWithOrganization = defaultMemberships.map(({ membership, registration }) => {
                        const organizationId = registration.organizationId;
                        const organization = organizations.find(o => o.id === organizationId);
                        return { membership, registration, organization };
                    });

                    const shouldApplyReducedPrice = me.details.shouldApplyReducedPrice;

                    // We'll by default give this member the most cheap membership it can get, and if the price is the same, the membership associated with the first registration
                    const cheapestMembership = defaultMembershipsWithOrganization.sort((a, b) => {
                        const tagIdsA = a.organization?.meta.tags ?? [];
                        const tagIdsB = b.organization?.meta.tags ?? [];
                        let aPrice = a.membership.getPrice(
                            period.id,
                            a.registration.startDate ?? a.registration.registeredAt ?? a.registration.createdAt,
                            tagIdsA,
                            shouldApplyReducedPrice,
                        ) ?? 10000000;
                        let bPrice = b.membership.getPrice(
                            period.id,
                            b.registration.startDate ?? b.registration.registeredAt ?? b.registration.createdAt,
                            tagIdsB,
                            shouldApplyReducedPrice,
                        ) ?? 10000000;

                        const chargeVia = platform.membershipOrganizationId;
                        if (a.registration.organizationId === chargeVia) {
                            aPrice = 0;
                        }

                        if (b.registration.organizationId === chargeVia) {
                            bPrice = 0;
                        }

                        const diff = aPrice - bPrice;
                        if (diff === 0) {
                            return Sorter.stack(
                                Sorter.byDateValue(
                                    b.registration.startDate ?? b.registration.registeredAt ?? b.registration.createdAt,
                                    a.registration.startDate ?? a.registration.registeredAt ?? a.registration.createdAt,
                                ),
                                Sorter.byDateValue(
                                    b.registration.createdAt,
                                    a.registration.createdAt,
                                ),
                            );
                        }
                        return diff;
                    })[0];

                    if (!cheapestMembership) {
                        // Technically not possible, but for type checking
                        console.error('No membership found');
                        continue;
                    }

                    // Check if already have the same membership
                    // if that is the case, we'll keep that one and update the price + dates if the organization matches the cheapest/earliest membership
                    let didFind: MemberPlatformMembership | null = null;

                    // First, try to find any undeletable membership - use this as the priority one and delete all others that can be deleted
                    // Check if we do have the same membership for a different organization that cannot be deleted (locked)
                    // This is to prevent creating duplicate memberships
                    for (const m of activeMemberships) {
                        if (m.membershipTypeId === cheapestMembership.membership.id && m.locked) {
                            didFind = m;
                            break;
                        }
                    }

                    const membership = new MemberPlatformMembership();

                    if (!didFind) {
                        // Calculate price - do not save yet
                        const periodConfig = cheapestMembership.membership.periods.get(period.id);
                        if (!periodConfig) {
                            console.error('Missing membership prices for membership type ' + cheapestMembership.membership.id + ' and period ' + period.id);
                            continue;
                        }

                        // Pre calculate the price
                        membership.memberId = me.id;
                        membership.membershipTypeId = cheapestMembership.membership.id;
                        membership.organizationId = cheapestMembership.registration.organizationId;
                        membership.periodId = period.id;

                        // Note: the dates will get modified in the price calculation
                        membership.startDate = periodConfig.startDate;
                        membership.endDate = periodConfig.endDate;
                        membership.expireDate = periodConfig.expireDate;
                        membership.generated = true;
                        await PlatformMembershipService.calculatePrice(membership, me, cheapestMembership.registration);

                        // Check if we have a not-locked but non-generated one that is cheaper
                        // if so, we stop and don't create a new one (but still delete others if required)
                        for (const m of activeMemberships) {
                            if (m.membershipTypeId === cheapestMembership.membership.id && !m.generated) {
                                // is this cheaper?
                                if (m.price <= membership.price) { // todo expand with more details price comparison
                                    // Cheaper
                                    didFind = m;
                                    break;
                                }
                            }
                        }
                    }

                    // Then update all memberships from the same organization for the selected registration date range
                    for (const m of activeMemberships) {
                        if (m.membershipTypeId === cheapestMembership.membership.id && m.organizationId === cheapestMembership.registration.organizationId) {
                            if (!m.locked && m.generated) {
                                // Update the price and dates of this active membership (could have changed)
                                try {
                                    await PlatformMembershipService.calculatePrice(m, me, cheapestMembership.registration);
                                } catch (e) {
                                    // Ignore error: membership might not be available anymore
                                    if (!silent) {
                                        console.error('Failed to calculate price for active membership', m.id, e);
                                    }
                                }
                                await m.save();
                            }

                            if (!didFind) {
                                didFind = m;
                            }
                        }
                    }

                    // Delete all other generated memberships that are not the chosen one
                    for (const m of activeMemberships) {
                        if (m.id !== didFind?.id) {
                            if (!m.locked && (m.generated || m.membershipTypeId === cheapestMembership.membership.id)) {
                                if (!silent) {
                                    console.log('Removing membership because cheaper membership found or duplicate, for: ' + me.id + ' - membership ' + m.id);
                                }
                                await m.doDelete();
                            } else if (m.membershipTypeId === cheapestMembership.membership.id) {
                                // Update price
                                if (!m.locked) {
                                    try {
                                        await PlatformMembershipService.calculatePrice(m, me);
                                    } catch (e) {
                                    // Ignore error: membership might not be available anymore
                                        if (!silent) {
                                            console.error('Failed to calculate price for undeletable membership', m.id, e);
                                        }
                                    }
                                    await m.save();
                                }
                            }
                        }
                    }

                    // We already have a membership, don't create a new one
                    if (didFind) {
                        continue;
                    }

                    // Can we revive an earlier deleted membership?
                    if (!silent) {
                        console.log('Creating automatic membership for: ' + me.id + ' - membership type ' + cheapestMembership.membership.id);
                    }

                    if (me.details.memberNumber === null) {
                        try {
                            await MemberNumberService.assignMemberNumber(me, membership);
                        } catch (error) {
                            console.error(`Failed to assign member number for id ${me.id}: ${error.message}`);
                            // If the assignment of the member number fails the membership is not created but the member is registered
                            continue;
                        }
                    }

                    await membership.save();
                }
            });
        });
    }

    /**
     * Returns the last trial until date for this member. Null if this member does not have any trials
     */
    private static async isElegibleForTrial(membership: MemberPlatformMembership, member: Member) {
        const period = await RegistrationPeriod.getByID(membership.periodId);
        if (!period) {
            return null;
        }

        if (!period.previousPeriodId) {
            // We have no previous period = no data = no trials
            return null;
        }

        const platform = await Platform.getSharedStruct();
        const typeIds = platform.config.membershipTypes.filter(m => m.behaviour === PlatformMembershipTypeBehaviour.Period).map(m => m.id);

        const previousMembership = await MemberPlatformMembership.select()
            .where('memberId', member.id)
            .where('deletedAt', null)
            .where('periodId', period.previousPeriodId)
            .where('membershipTypeId', typeIds)
            .first(false);

        const hasBlockingMemberships = !!previousMembership;

        if (hasBlockingMemberships) {
            return null;
        }

        // The member needs to be registered for at least one registration that had a trial
        const registrations = await Registration.select()
            .where('memberId', member.id)
            .where('periodId', period.id)
            .where('organizationId', membership.organizationId)
            .where('deactivatedAt', null)
            .where('registeredAt', '!=', null)
            .where('trialUntil', '!=', null)
            .fetch();

        if (registrations.length === 0) {
            return null;
        }

        const latestTrialUntil = new Date(Math.max(...registrations.map(r => r.trialUntil!.getTime())));
        return latestTrialUntil;
    }

    private static async correctDates(membership: MemberPlatformMembership, member: Member, registration?: Registration) {
        if (membership.locked) {
            // price of locked membership cannot be changed
            return;
        }

        const platform = await Platform.getSharedPrivateStruct();
        const membershipType = platform.config.membershipTypes.find(m => m.id === membership.membershipTypeId);

        if (!membershipType) {
            throw new SimpleError({
                code: 'invalid_membership_type',
                message: 'Unknown membership type',
                human: $t(`%GM`),
            });
        }

        const periodConfig = membershipType.periods.get(membership.periodId);

        if (!periodConfig) {
            throw new SimpleError({
                code: 'period_unavailable',
                message: 'Membership not available for this period',
                human: $t(`%GN`),
            });
        }

        if (membershipType.behaviour === PlatformMembershipTypeBehaviour.Days) {
            // Make sure time is equal between start and end date
            let startBrussels = Formatter.luxon(membership.startDate);
            let endBrussels = Formatter.luxon(membership.endDate);
            startBrussels = startBrussels.set({ hour: 0, minute: 0, second: 0, millisecond: 0 });
            endBrussels = endBrussels.set({ hour: 23, minute: 59, second: 59, millisecond: 0 });
            membership.startDate = startBrussels.toJSDate();
            membership.endDate = endBrussels.toJSDate();
            membership.expireDate = null;
        } else {
            membership.endDate = Formatter.luxon(periodConfig.endDate).set({ hour: 23, minute: 59, second: 59, millisecond: 0 }).toJSDate();
            membership.expireDate = periodConfig.expireDate ? Formatter.luxon(periodConfig.expireDate).set({ hour: 23, minute: 59, second: 59, millisecond: 0 }).toJSDate() : null;

            // Alter start date
            if (registration) {
                const preferredStartDate = registration.startDate ?? registration.registeredAt ?? membership.createdAt;
                membership.startDate = periodConfig.startDate;

                if (preferredStartDate > periodConfig.startDate && preferredStartDate < periodConfig.endDate) {
                    let startBrussels = Formatter.luxon(preferredStartDate);
                    startBrussels = startBrussels.set({ hour: 0, minute: 0, second: 0, millisecond: 0 });
                    membership.startDate = startBrussels.toJSDate();
                }
            } else {
                // Keep the set date, but make sure it is at 0:00 in CET
                let startBrussels = Formatter.luxon(membership.startDate);
                startBrussels = startBrussels.set({ hour: 0, minute: 0, second: 0, millisecond: 0 });
                membership.startDate = startBrussels.toJSDate();
            }
        }

        let minimumStartDate = Formatter.luxon(periodConfig.startDate).set({ hour: 0, minute: 0, second: 0, millisecond: 0 }).toJSDate();

        if (!membership.existsInDatabase) {
            if (membershipType.behaviour === PlatformMembershipTypeBehaviour.Days) {
                // Cannot create a membership in the past
                minimumStartDate = Formatter.luxon(new Date()).set({ hour: 0, minute: 0, second: 0, millisecond: 0 }).toJSDate();
            }
        }

        if (membership.startDate < minimumStartDate) {
            membership.startDate = minimumStartDate;
        }

        if (membership.endDate < membership.startDate) {
            membership.endDate = Formatter.luxon(membership.startDate).set({ hour: 23, minute: 59, second: 59, millisecond: 0 }).toJSDate();
        }

        const maximumEndDate = periodConfig.getMaximumEndDate(membership.startDate, membershipType.behaviour);
        if (membership.endDate > maximumEndDate) {
            throw new SimpleError({
                code: 'invalid_field',
                field: 'endDate',
                message: 'End date is after the maximum allowed end date',
                human: $t('%15C', { date: Formatter.date(maximumEndDate) }),
            });
        }

        if (periodConfig.trialDays) {
            // Check whether you are elegible for a trial
            const latestTrialDate = await PlatformMembershipService.isElegibleForTrial(membership, member);
            if (latestTrialDate !== null) {
                // Allowed to set trial until, maximum periodConfig.trialDays after startDate
                let trialUntil = Formatter.luxon(membership.startDate).plus({ days: periodConfig.trialDays });
                trialUntil = trialUntil.set({ hour: 23, minute: 59, second: 59, millisecond: 0 });

                if (trialUntil.toJSDate() > latestTrialDate) {
                    // Use the latest trial date instead
                    trialUntil = Formatter.luxon(latestTrialDate);
                }

                // Max end date
                if (trialUntil.toJSDate() > membership.endDate) {
                    trialUntil = Formatter.luxon(membership.endDate).set({ hour: 23, minute: 59, second: 59, millisecond: 0 });
                }

                membership.trialUntil = trialUntil.toJSDate();
            } else {
                membership.trialUntil = null;
            }
        } else {
            // No trial
            membership.trialUntil = null;
        }
    }

    static async calculatePrice(membership: MemberPlatformMembership, member: Member, registration?: Registration) {
        if (membership.locked) {
            // price of locked membership cannot be changed
            return;
        }

        const platform = await Platform.getSharedPrivateStruct();
        const membershipType = platform.config.membershipTypes.find(m => m.id === membership.membershipTypeId);

        if (!membershipType) {
            throw new SimpleError({
                code: 'invalid_membership_type',
                message: 'Unknown membership type',
                human: $t(`%GM`),
            });
        }

        const periodConfig = membershipType.periods.get(membership.periodId);

        if (!periodConfig) {
            throw new SimpleError({
                code: 'period_unavailable',
                message: 'Membership not available for this period',
                human: $t(`%GN`),
            });
        }

        const organization = await Organization.getByID(membership.organizationId);
        if (!organization) {
            throw new SimpleError({
                // todo
                code: 'not_found',
                message: 'Organization not found',
                human: $t(`%GO`),
            });
        }

        const tagIds = organization.meta.tags;
        const shouldApplyReducedPrice = member.details.shouldApplyReducedPrice;

        // Correct dates so we get the correct price config
        await PlatformMembershipService.correctDates(membership, member, registration);
        const priceConfig = periodConfig.getPriceConfigForDate(membership.trialUntil ?? membership.startDate);
        const earliestPriceConfig = periodConfig.getPriceConfigForDate(new Date(1950, 0, 1));

        let freeDays = 0;

        const d = membership.createdAt ?? new Date();

        if (periodConfig.amountFree) {
            // Check if this organization has rights to free memberships
            const alreadyUsed = await MemberPlatformMembership.select()
                .where('organizationId', membership.organizationId)
                .where('membershipTypeId', membership.membershipTypeId)
                .where('periodId', membership.periodId)
                .where('deletedAt', null)
                .whereNot('id', membership.id)
                .where(
                    SQL.where('createdAt', SQLWhereSign.Less, d)
                        .or(
                            SQL.where('createdAt', SQLWhereSign.Equal, d)
                                .and('id', SQLWhereSign.Less, membership.id),
                        ),
                )
                .sum(SQL.column('maximumFreeAmount'));

            if (alreadyUsed < periodConfig.amountFree) {
                freeDays = periodConfig.amountFree - alreadyUsed;
                console.log('Free membership created for ', membership.id, periodConfig.amountFree, alreadyUsed);
            } else {
                console.log('No free membership created for', membership.id, periodConfig.amountFree, alreadyUsed);
            }
        }

        if (membershipType.behaviour === PlatformMembershipTypeBehaviour.Days) {
            const days = Math.round((membership.endDate.getTime() - membership.startDate.getTime()) / (1000 * 60 * 60 * 24));
            membership.maximumFreeAmount = days;
            membership.priceWithoutDiscount = earliestPriceConfig.calculatePrice(tagIds, false, days);
            membership.price = priceConfig.calculatePrice(tagIds, shouldApplyReducedPrice, Math.max(0, days - freeDays));
            membership.freeAmount = Math.min(days, freeDays);
        } else {
            membership.priceWithoutDiscount = earliestPriceConfig.getBasePrice(tagIds, false);
            membership.price = priceConfig.getBasePrice(tagIds, shouldApplyReducedPrice);
            membership.maximumFreeAmount = membership.price > 0 ? 1 : 0;
            membership.freeAmount = 0;

            if (freeDays > 0) {
                membership.price = 0;
                membership.freeAmount = 1;
            }
        }

        // Never charge itself
        const chargeVia = platform.membershipOrganizationId;
        if (membership.organizationId === chargeVia) {
            membership.price = 0;
            membership.priceWithoutDiscount = 0;
            membership.freeAmount = 0;
            membership.maximumFreeAmount = 0;
        }

        if (membership.balanceItemId) {
            membership.maximumFreeAmount = membership.freeAmount;

            // Also update the balance item
            const balanceItem = await BalanceItem.getByID(membership.balanceItemId);
            if (balanceItem) {
                balanceItem.unitPrice = membership.price;
                await balanceItem.save();

                // await BalanceItem.updateOutstanding([balanceItem]);
            }
        }
    }
}
