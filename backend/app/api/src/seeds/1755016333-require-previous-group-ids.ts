import { Migration } from '@simonbackx/simple-database';
import { Group, Organization, RegistrationPeriod } from '@stamhoofd/models';
import { GroupStatus } from '@stamhoofd/structures';
import { Sorter } from '@stamhoofd/utility';

export default new Migration(async () => {
    if (STAMHOOFD.environment === 'test') {
        console.log('skipped in tests');
        return;
    }

    if (STAMHOOFD.platformName.toLowerCase() !== 'stamhoofd') {
        console.log('skipped for platform (only runs for Stamhoofd): ' + STAMHOOFD.platformName);
        return;
    }

    await startRequireAndPreventPreviousGroupIdsMigration(true);
});

/**
 *
 * @param dryRun for testing
 */
export async function startRequireAndPreventPreviousGroupIdsMigration(dryRun: boolean) {
    for await (const organization of Organization.select().all()) {
        const groups = await Group.select().where('organizationId', organization.id).fetch();
        if (groups.length === 0) {
            continue;
        }

        const periods = await RegistrationPeriod.select()
            .where('organizationId', organization.id)
            .fetch();

        if (periods.length === 0) {
            throw new Error(`No periods found for organization ${organization.id}`);
        }

        if (periods.length === 1) {
            // cannot require to be registered for previous group if no previous period
            for (const group of groups) {
                group.settings.requirePreviousGroupIds = [];
                group.settings.preventPreviousGroupIds = [];

                if (!dryRun) {
                    await group.save();
                }
            }
            continue;
        }

        const currentPeriod = periods.find(p => p.id === organization.periodId);
        if (!currentPeriod) {
            throw new Error(`Current period with id ${organization.periodId} not found for organization ${organization.id}`);
        }

        const previousPeriods = periods.filter((p) => {
            if (p.id === organization.periodId) {
                return false;
            }

            if (p.startDate > currentPeriod.startDate) {
                return false;
            }

            return true;
        });

        const previousPeriodIds = new Set(previousPeriods.map(p => p.id));

        const previousGroupsSorted = groups.filter(g => previousPeriodIds.has(g.periodId));

        // sort from new to old
        previousGroupsSorted.sort((g1, g2) => {
            // sort by period startDate
            const p1 = previousPeriods.find(p => p.id === g1.periodId)!;
            const p2 = previousPeriods.find(p => p.id === g2.periodId)!;
            const result = Sorter.byDateValue(p1.startDate, p2.startDate);
            if (result === 0) {
                // sort by start date of group
                const result2 = Sorter.byDateValue(g1.settings.startDate, g2.settings.startDate);
                if (result2 !== 0) {
                    return result2;
                }

                // sort by status
                if (g1.status === g2.status) {
                    return 0;
                }

                // groups with status open should come first
                if (g1.status === GroupStatus.Open) {
                    return -1;
                }

                return 1;
            }

            return result;
        });

        for (const group of groups) {
            const requireGroupIds = new Set(group.settings.requireGroupIds);
            const preventGroupIds = new Set(group.settings.preventGroupIds);

            // there are no future periods after the migration, so if the period is different this means it is a period in the past
            // requirePreviousGroupIds should not be migrated for past periods
            if (group.periodId !== organization.periodId) {
                group.settings.requirePreviousGroupIds = [];
                group.settings.preventPreviousGroupIds = [];
                if (!dryRun) {
                    await group.save();
                }
                continue;
            }

            for (const groupIdToGetPreviousGroupOf of group.settings.requirePreviousGroupIds) {
                const previousGroups = getFirstPreviousGroup(groupIdToGetPreviousGroupOf, { groups, previousGroupsSorted, periods, previousPeriods });
                previousGroups.forEach(g => requireGroupIds.add(g.id));
            }

            for (const groupIdToGetPreviousGroupOf of group.settings.preventPreviousGroupIds) {
                const previousGroups = getFirstPreviousGroup(groupIdToGetPreviousGroupOf, { groups, previousGroupsSorted, periods, previousPeriods });
                previousGroups.forEach(g => preventGroupIds.add(g.id));
            }

            group.settings.requireGroupIds = Array.from(requireGroupIds);
            group.settings.preventGroupIds = Array.from(preventGroupIds);

            if (!dryRun) {
                await group.save();
            }
        }
    }

    if (dryRun) {
        throw new Error('Migration not finished, run again without dryRun');
    }
}

function getFirstPreviousGroup(groupId: string, { groups, previousGroupsSorted, periods, previousPeriods }: { groups: Group[]; previousGroupsSorted: Group[]; periods: RegistrationPeriod[]; previousPeriods: RegistrationPeriod[] }): Group[] {
    const groupToGetPreviousGroupOf = groups.find(g => g.id === groupId);

    if (!groupToGetPreviousGroupOf) {
        throw new Error(`Group to get previous group of with id ${groupId} not found`);
    }

    const periodOfGroupToGetPreviousGroupOf = periods.find(p => p.id === groupToGetPreviousGroupOf.periodId);

    if (periodOfGroupToGetPreviousGroupOf === undefined) {
        throw new Error(`Period of group to get previous group of with id ${groupToGetPreviousGroupOf.id} not found`);
    }

    const samePreviousGroups = previousGroupsSorted.filter((g) => {
        if (g.id !== groupToGetPreviousGroupOf.id && g.settings.name.toString() === groupToGetPreviousGroupOf.settings.name.toString()
            && g.type === groupToGetPreviousGroupOf.type
            && g.settings.description.toString() === groupToGetPreviousGroupOf.settings.description.toString()) {
            const period = previousPeriods.find(p => p.id === g.periodId)!;
            if (period.startDate < periodOfGroupToGetPreviousGroupOf.startDate) {
                return true;
            }
        }
        return false;
    },
    );

    const firstPreviousGroup = samePreviousGroups[0];

    if (!firstPreviousGroup) {
        throw new Error(`Previous group for ${groupId} not found`);
    }

    if (samePreviousGroups.length > 1) {
        const samePeriodAndStatus = samePreviousGroups.filter(g => g.periodId === firstPreviousGroup.periodId && g.status === firstPreviousGroup.status && g.settings.startDate.getTime() === firstPreviousGroup.settings.startDate.getTime());

        if (samePeriodAndStatus.length === 0) {
            throw new Error('Should not happen, mistake in logic ' + groupToGetPreviousGroupOf.id);
        }

        // should add other equal groups if they have the same period, status and start date
        if (samePeriodAndStatus.length > 1) {
            console.log(`Multiple previous groups for ${groupId}, adding all`);
            return samePeriodAndStatus;
        }
    }

    return [firstPreviousGroup];
}
