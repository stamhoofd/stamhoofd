import { Model } from '@simonbackx/simple-database';
import { logger } from '@simonbackx/simple-logging';
import { Group, Member, MemberPlatformMembership, Organization, Platform, Registration } from '@stamhoofd/models';
import { QueueHandler } from '@stamhoofd/queues';
import { SQL } from '@stamhoofd/sql';
import { AuditLogSource } from '@stamhoofd/structures';
import { Formatter, Sorter } from '@stamhoofd/utility';
import { AuditLogService } from './AuditLogService';
import { MemberNumberService } from './MemberNumberService';

export class PlatformMembershipService {
    static listen() {
        // Listen for group changes
        Model.modelEventBus.addListener(this, (event) => {
            if (!(event.model instanceof Group)) {
                return;
            }

            // Check if group has been deleted
            if (event.type === 'deleted' || (event.type === 'updated' && (event.changedFields['deletedAt'] !== undefined || event.changedFields['defaultAgeGroupId'] !== undefined))) {
                PlatformMembershipService.updateMembershipsForGroupId(event.model.id);
            }
        });
    }

    static async updateAll() {
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

    static updateMembershipsForGroupId(id: string) {
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
        return await AuditLogService.setContext({ source: AuditLogSource.System }, async () => {
            await QueueHandler.schedule('updateMemberships-' + id, async function (this: undefined) {
                if (!silent) {
                    console.log('update memberships for id ', id);
                }

                const me = await Member.getWithRegistrations(id);
                if (!me) {
                    if (!silent) {
                        console.log('Skipping automatic membership for: ' + id, ' - member not found');
                    }
                    return;
                }
                const platform = await Platform.getShared();
                const registrations = me.registrations.filter(r => r.group.periodId === platform.periodId && r.registeredAt && !r.deactivatedAt);
                const now = new Date();

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
                    const periodConfig = defaultMembership.periods.get(platform.periodId);

                    if (periodConfig === undefined) {
                        console.warn('Found default membership without period configuration', defaultMembership.id, platform.periodId);
                        return [];
                    }

                    if (!(periodConfig.startDate <= now && periodConfig.endDate >= now)) {
                        // Do not add this membership automatically because it won't match as an active membership
                        // later on (edge case but otherwise we'll get duplicate memberships and add a new one every time)
                        return [];
                    }

                    return [{
                        registration: r,
                        membership: defaultMembership,
                    }];
                });

                // Get active memberships for this member that
                const memberships = await MemberPlatformMembership.where({ memberId: me.id, periodId: platform.periodId });
                const activeMemberships = memberships.filter(m => m.startDate <= now && m.endDate >= now && m.deletedAt === null);
                const activeMembershipsUndeletable = activeMemberships.filter(m => !m.canDelete() || !m.generated);

                if (defaultMemberships.length === 0) {
                    // Stop all active memberships that were added automatically
                    for (const membership of activeMemberships) {
                        if (membership.canDelete() && membership.generated) {
                            if (!silent) {
                                console.log('Removing membership because no longer registered member and not yet invoiced for: ' + me.id + ' - membership ' + membership.id);
                            }
                            membership.deletedAt = new Date();
                            await membership.save();
                        }
                    }

                    if (!silent) {
                        console.log('Skipping automatic membership for: ' + me.id, ' - no default memberships found');
                    }
                    return;
                }

                if (activeMembershipsUndeletable.length) {
                    // Skip automatic additions
                    for (const m of activeMembershipsUndeletable) {
                        try {
                            await m.calculatePrice(me);
                        }
                        catch (e) {
                            // Ignore error: membership might not be available anymore
                            if (!silent) {
                                console.error('Failed to calculate price for undeletable membership', m.id, e);
                            }
                        }
                        await m.save();
                    }
                    return;
                }

                // Add the cheapest available membership
                const organizations = await Organization.getByIDs(...Formatter.uniqueArray(defaultMemberships.map(m => m.registration.organizationId)));

                const defaultMembershipsWithOrganization = defaultMemberships.map(({ membership, registration }) => {
                    const organizationId = registration.organizationId;
                    const organization = organizations.find(o => o.id === organizationId);
                    return { membership, registration, organization };
                });

                const shouldApplyReducedPrice = me.details.shouldApplyReducedPrice;

                const cheapestMembership = defaultMembershipsWithOrganization.sort(({ membership: a, registration: ar, organization: ao }, { membership: b, registration: br, organization: bo }) => {
                    const tagIdsA = ao?.meta.tags ?? [];
                    const tagIdsB = bo?.meta.tags ?? [];
                    const diff = a.getPrice(platform.periodId, now, tagIdsA, shouldApplyReducedPrice)! - b.getPrice(platform.periodId, now, tagIdsB, shouldApplyReducedPrice)!;
                    if (diff == 0) {
                        return Sorter.byDateValue(br.createdAt, ar.createdAt);
                    }
                    return diff;
                })[0];
                if (!cheapestMembership) {
                    throw new Error('No membership found');
                }

                // Check if already have the same membership
                for (const m of activeMemberships) {
                    if (m.membershipTypeId === cheapestMembership.membership.id) {
                        // Update the price of this active membership (could have changed)
                        try {
                            await m.calculatePrice(me);
                        }
                        catch (e) {
                            // Ignore error: membership might not be available anymore
                            if (!silent) {
                                console.error('Failed to calculate price for active membership', m.id, e);
                            }
                        }
                        await m.save();
                        return;
                    }
                }

                const periodConfig = cheapestMembership.membership.periods.get(platform.periodId);
                if (!periodConfig) {
                    console.error('Missing membership prices for membership type ' + cheapestMembership.membership.id + ' and period ' + platform.periodId);
                    return;
                }

                // Can we revive an earlier deleted membership?
                if (!silent) {
                    console.log('Creating automatic membership for: ' + me.id + ' - membership type ' + cheapestMembership.membership.id);
                }
                const membership = new MemberPlatformMembership();
                membership.memberId = me.id;
                membership.membershipTypeId = cheapestMembership.membership.id;
                membership.organizationId = cheapestMembership.registration.organizationId;
                membership.periodId = platform.periodId;

                membership.startDate = periodConfig.startDate;
                membership.endDate = periodConfig.endDate;
                membership.expireDate = periodConfig.expireDate;
                membership.generated = true;

                if (me.details.memberNumber === null) {
                    try {
                        await MemberNumberService.assignMemberNumber(me, membership);
                    }
                    catch (error) {
                        console.error(`Failed to assign member number for id ${me.id}: ${error.message}`);
                        // If the assignment of the member number fails the membership is not created but the member is registered
                        return;
                    }
                }

                await membership.calculatePrice(me);
                await membership.save();

                // This reasoning allows us to replace an existing membership with a cheaper one (not date based ones, but type based ones)
                for (const toDelete of activeMemberships) {
                    if (toDelete.canDelete() && toDelete.generated) {
                        if (!silent) {
                            console.log('Removing membership because cheaper membership found for: ' + me.id + ' - membership ' + toDelete.id);
                        }
                        toDelete.deletedAt = new Date();
                        await toDelete.save();
                    }
                }
            });
        });
    }
}
