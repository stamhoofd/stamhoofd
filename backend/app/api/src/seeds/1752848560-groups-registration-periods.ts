import { Migration } from '@simonbackx/simple-database';
import { Group, Organization, OrganizationRegistrationPeriod, Registration, RegistrationPeriod, User, UserFactory } from '@stamhoofd/models';
import { CycleInformation, GroupCategory, GroupCategorySettings, GroupPrivateSettings, GroupSettings, GroupStatus, GroupType, PermissionLevel, Permissions, RegistrationPeriodSettings, TranslatedString } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

type CycleData = {
    cycle: number;
    startDate: Date;
    endDate: Date;
    groups: Group[];
};

const cycleIfMigrated = -99;

function limitDate(date: Date): Date {
    // some dates are very old and this throws an error otherwise
    if (date.getFullYear() < 1950) {
        return new Date(1950, date.getMonth(), date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds());
    }

    if (date.getFullYear() > 2050) {
        return new Date(2050, date.getMonth(), date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds());
    }
    return date;
}

function checkIsSamePeriod(period1: { startDate: Date; endDate: Date }, period2: { startDate: Date; endDate: Date }): boolean {
    // check total percentage overlap, if big percentage -> return true because probably wrong year
    const { daysOverlapping, longestPeriodInDays } = getDaysMissingAndOverlap(period1, period2);
    const percentageOverlap = daysOverlapping / longestPeriodInDays;
    return percentageOverlap > 0.9;
}

function checkCycleDuration(startDate: Date, endDate: Date): number | null {
    const days = differenceInDays(startDate, endDate);

    // if longer than 7 months (31 x 7)
    if (days > 217) {
        return 12;
    }

    // if longer than 4 months (31 x 4)
    if (days > 124) {
        return 6;
    }

    return null;
}

const currentYear = new Date().getFullYear();

function getDefaultCurrentCyclePeriod() {
    return {
        startDate: new Date(currentYear, 8, 1),
        endDate: new Date(currentYear + 1, 7, 31),
    };
}

async function getGroupStartAndEndDate({ groupId, cycle, startDate, endDate }: { groupId: string; cycle: number; startDate: Date; endDate: Date }): Promise<{ startDate: Date; endDate: Date; cycleDuration: number } | null> {
    const allRegistrations = await Registration.select()
        .where('groupId', groupId)
        .where('cycle', cycle).fetch();

    // oldest first
    const sortedRegistrationDates = (allRegistrations.filter(r => r.registeredAt).map(r => r.registeredAt) as Date[]).sort((a, b) => a.getTime() - b.getTime());

    if (sortedRegistrationDates.length === 0) {
        return null;
    }

    const minStartDate = sortedRegistrationDates[0];
    const maxEndDate = sortedRegistrationDates[sortedRegistrationDates.length - 1];

    if (minStartDate.getTime() < startDate.getTime()) {
        startDate = minStartDate;
    }

    if (maxEndDate.getTime() > endDate.getTime()) {
        endDate = maxEndDate;
    }

    const cycleDuration = checkCycleDuration(startDate, endDate);
    if (cycleDuration !== null) {
        return { startDate: new Date(startDate), endDate: new Date(endDate), cycleDuration };
    }

    return null;
}

// function isValidDate(d: Date): boolean {
//     return d instanceof Date && !isNaN(d.getTime()) && d.getFullYear() > 1000;
// }

async function correctGroupStartAndEndDate({ groupId, cycle, startDate, endDate }: { groupId: string; cycle: number; startDate: Date; endDate: Date }): Promise<{ startDate: Date; endDate: Date; cycleDuration: number }> {
    const result = await getGroupStartAndEndDate({ groupId, cycle, startDate, endDate });
    if (result !== null) {
        return result;
    }

    let cycleCorrection = 0;

    while ((cycle - cycleCorrection) > 0) {
        cycleCorrection = cycleCorrection + 1;
        const result = await getGroupStartAndEndDate({ groupId, cycle: cycle - cycleCorrection, startDate, endDate });

        if (result) {
            const cycleDuration = result.cycleDuration!;

            let correctedStartDate = new Date(result.startDate.getTime());
            let correctedEndDate = new Date(result.endDate.getTime());
            correctedStartDate.setMonth(correctedStartDate.getMonth() + (cycleCorrection * cycleDuration));
            correctedEndDate.setMonth(correctedEndDate.getMonth() + (cycleCorrection * cycleDuration));

            if (startDate.getTime() < correctedStartDate.getTime()) {
                correctedStartDate = new Date(startDate);
            }

            if (endDate.getTime() > correctedEndDate.getTime()) {
                correctedEndDate = new Date(endDate);
            }

            return {
                startDate: correctedStartDate,
                endDate: correctedEndDate,
                cycleDuration,
            };
        }
    }

    const defaultResult = getDefaultCurrentCyclePeriod();

    return {
        startDate: defaultResult.startDate,
        endDate: defaultResult.endDate,
        cycleDuration: 12,
    };
}

/**
 * Often cycle settings contains information about various cycles without start and end date.
 * Therefore a good start and end date should be calculated.
 */
export async function correctCycleSettings(groupId: string, cycleSettings: Map<number, CycleInformation>, startDate: Date, endDate: Date, currentCycle: number): Promise<Map<number, { startDate: Date; endDate: Date }>> {
    // const isLog = groupId === '8b79302f-2df1-4e0f-b9d6-56396d2389dd';
    const isLog = false;

    if (endDate < startDate) {
        // switch start and end dates
        const originalStartDate = startDate;
        const originalEndDate = endDate;
        startDate = originalEndDate;
        endDate = originalStartDate;
    }

    const array = [...cycleSettings.entries()].map((entry) => {
        const cycle = entry[0];
        const settings = entry[1];
        return {
            cycle,
            settings,
        };
    });

    // reversed (newest cycle first)
    array.sort((a, b) => b.cycle - a.cycle);

    let lastStartDate: Date = new Date(startDate);

    const firstResults: { cycle: number; startDate: Date; endDate: Date }[] = [];

    // check cycle duration in months
    let cycleDuration = checkCycleDuration(startDate, endDate);

    if (cycleDuration === null) {
        // correct the start and end date if the cycle duration is shorter than 6 months
        const result = await correctGroupStartAndEndDate({ groupId, cycle: currentCycle, startDate, endDate });
        startDate = result.startDate;
        endDate = result.endDate;
        cycleDuration = result.cycleDuration;
    }

    let cycleCorrections = 0;

    // loop first time and calculate start and end dates
    for (const item of array) {
        // if (item.cycle === currentCycle) {
        //     continue;
        // }

        let itemStartDate = item.settings.startDate ? new Date(item.settings.startDate.getTime()) : null;
        let itemEndDate = item.settings.endDate ? new Date(item.settings.endDate.getTime()) : null;

        if (itemStartDate && itemEndDate) {
            if (itemEndDate.getTime() < itemStartDate.getTime()) {
            // switch start and end dates
                const originalStartDate = itemStartDate;
                const originalEndDate = itemEndDate;
                itemStartDate = originalEndDate;
                itemEndDate = originalStartDate;
            }
        }
        else {
            if (itemEndDate === null) {
                itemEndDate = new Date(lastStartDate.getTime() - 1);
            }

            if (itemStartDate === null) {
                const newStartDate = new Date(lastStartDate.getTime());
                const cycleOffset = currentCycle - item.cycle - cycleCorrections;
                newStartDate.setMonth(newStartDate.getMonth() - (cycleOffset * cycleDuration));
                itemStartDate = newStartDate;
            }
        }

        // todo: check overlap
        const previousPeriod = firstResults[firstResults.length - 1];
        if (previousPeriod) {
            const isSamePeriod = checkIsSamePeriod(
                { startDate: itemStartDate, endDate: itemEndDate },
                { startDate: previousPeriod.startDate, endDate: previousPeriod.endDate },
            );

            if (isSamePeriod) {
                cycleCorrections++;
                // move 1 period back
                itemStartDate.setMonth(itemStartDate.getMonth() - cycleDuration);
                itemEndDate.setMonth(itemEndDate.getMonth() - cycleDuration);
            }
        }

        lastStartDate = new Date(itemStartDate);

        firstResults.push({
            cycle: item.cycle,
            startDate: new Date(itemStartDate),
            endDate: new Date(itemEndDate),
        });
    }

    const finalResults: { cycle: number; startDate: Date; endDate: Date }[] = [];

    // loop second time and correct the dates depending on existing registrations
    for (let i = 0; i < firstResults.length; i++) {
        const item = firstResults[i];

        // check if the dates had been configured correct by the organization
        const allRegistrations = await Registration.select()
            .where('groupId', groupId)
            .where('cycle', item.cycle).fetch();

        // skip the period if there are no registrations, except for current cycle
        if (item.cycle !== currentCycle && allRegistrations.length === 0) {
            continue;
        }

        // oldest first
        const sortedRegistrationDates = (allRegistrations.filter(r => r.registeredAt).map(r => r.registeredAt) as Date[]).sort((a, b) => a.getTime() - b.getTime());

        const isLog2 = isLog && item.cycle === 0;

        if (sortedRegistrationDates.length !== 0) {
            const minStartDate = sortedRegistrationDates[0];
            const maxEndDate = sortedRegistrationDates[sortedRegistrationDates.length - 1];

            // correct the dates if there are registrations outside the dates
            if (minStartDate.getTime() < item.startDate.getTime() || maxEndDate.getTime() > item.endDate.getTime()) {
                // older cycle
                const nextItem: {
                    cycle: number;
                    startDate: Date;
                    endDate: Date;
                } | undefined = firstResults[i + 1];

                // more recent cycle
                const previousItem: {
                    cycle: number;
                    startDate: Date;
                    endDate: Date;
                } | undefined = firstResults[i - 1];

                const correctedDates = getCorrectedDates({
                    registeredAtDates: sortedRegistrationDates,
                    startDate: item.startDate,
                    endDate: item.endDate,
                    minStartDate,
                    maxEndDate,
                    previousCycle: previousItem ?? { startDate, endDate },
                    nextCycle: nextItem,
                    cycleDuration,
                }, isLog2);

                // todo: redo all?

                item.startDate = correctedDates.startDate;
                item.endDate = correctedDates.endDate;
            }
        }

        if (isLog2) {
            throw new Error(`item: ${JSON.stringify(item)}, sortedRegistrationDates: ${JSON.stringify(sortedRegistrationDates)}, cycleDuration: ${cycleDuration}`);
        }

        finalResults.push(item);
    }

    return new Map([...finalResults].reverse().map(item => [item.cycle, { startDate: item.startDate, endDate: item.endDate }]));
}

function getCorrectedDates({ registeredAtDates, minStartDate, maxEndDate, startDate, endDate, previousCycle, nextCycle, cycleDuration }: { registeredAtDates: Date[]; minStartDate: Date; maxEndDate: Date; startDate: Date; endDate: Date; previousCycle: { startDate: Date; endDate: Date }; nextCycle?: { startDate: Date; endDate: Date }; cycleDuration: number }, isLog: boolean) {
    // todo: check where most registration dates fit
    let bestMatchRegistrationCount = 0;
    let bestMatch: { startDate: Date; endDate: Date } | null = null as { startDate: Date; endDate: Date } | null;

    const updateBestMatch = (startDate: Date, endDate: Date) => {
        const registrationCount = registeredAtDates.filter(r => r.getTime() >= startDate.getTime() && r.getTime() <= endDate.getTime()).length;

        if (registrationCount > bestMatchRegistrationCount) {
            bestMatchRegistrationCount = registrationCount;
            bestMatch = { startDate, endDate };
        }
    };

    // try last cycle corrections
    for (const correction of [2, 1, -1, -2]) {
        const correctedStartDate = new Date(previousCycle.startDate.getTime());
        const endFromCycleDuration = new Date(correctedStartDate.getTime());
        endFromCycleDuration.setMonth(correctedStartDate.getMonth() + (cycleDuration));

        const correctedEndDate = new Date(Math.max(previousCycle.endDate.getTime(), endFromCycleDuration.getTime()));
        correctedStartDate.setMonth(correctedStartDate.getMonth() + (correction * cycleDuration));
        correctedEndDate.setMonth(correctedEndDate.getMonth() + (correction * cycleDuration));

        if (isLog) {
            console.log(`try ${correctedStartDate.toString()} - ${correctedEndDate.toString()}`);
        }

        if (!(minStartDate.getTime() < correctedStartDate.getTime() || maxEndDate.getTime() > correctedEndDate.getTime())) {
            return {
                startDate: correctedStartDate,
                endDate: correctedEndDate,
            };
        }

        updateBestMatch(correctedStartDate, correctedEndDate);
    }

    // try current cycle corrections
    for (const correction of [2, 1, -1, -2]) {
        const correctedStartDate = new Date(startDate.getTime());
        const endFromCycleDuration = new Date(correctedStartDate.getTime());
        endFromCycleDuration.setMonth(correctedStartDate.getMonth() + (cycleDuration));

        const correctedEndDate = new Date(Math.max(endDate.getTime(), endFromCycleDuration.getTime()));
        correctedStartDate.setMonth(correctedStartDate.getMonth() + (correction * cycleDuration));
        correctedEndDate.setMonth(correctedEndDate.getMonth() + (correction * cycleDuration));

        if (isLog) {
            console.log(`try ${correctedStartDate.toString()} - ${correctedEndDate.toString()}`);
        }

        if (!(minStartDate.getTime() < correctedStartDate.getTime() || maxEndDate.getTime() > correctedEndDate.getTime())) {
            return {
                startDate: correctedStartDate,
                endDate: correctedEndDate,
            };
        }

        updateBestMatch(correctedStartDate, correctedEndDate);
    }

    // Try to set the date to the min start date and max end date and see if overlap with other period
    let correctedStartDate: Date = new Date(startDate);
    let correctedEndDate: Date = new Date(endDate);

    if (minStartDate.getTime() < startDate.getTime()) {
        if ((nextCycle?.endDate === undefined || minStartDate.getTime() >= nextCycle.endDate.getTime())) {
            correctedStartDate = new Date(minStartDate.getTime());
        }
    }

    if (maxEndDate.getTime() > endDate.getTime()) {
        if (maxEndDate.getTime() <= previousCycle.startDate.getTime()) {
            correctedEndDate = new Date(maxEndDate.getTime());
        }
    }

    updateBestMatch(correctedStartDate, correctedEndDate);

    if (bestMatch) {
        return bestMatch;
    }

    return {
        startDate: correctedStartDate,
        endDate: correctedEndDate,
    };
}

export async function startGroupCyclesToPeriodsMigration(dryRun: boolean) {
    for await (const organization of Organization.select().all()) {
        const allCycles: CycleData[] = [];

        const groups = await Group.select().where('organizationId', organization.id).fetch();

        if (groups.some(g => g.cycle === cycleIfMigrated)) {
            continue;
        }

        console.log('Organization: ' + organization.name);
        for (const group of groups) {
            const cycle: number = group.cycle;
            const startDate: Date = limitDate(group.settings.startDate);
            const endDate: Date = limitDate(group.settings.endDate);

            const addCycle = (cycle: number, startDate: Date, endDate: Date) => {
                if (endDate < startDate) {
                    // switch start and end dates
                    const originalStartDate = startDate;
                    const originalEndDate = endDate;
                    startDate = originalEndDate;
                    endDate = originalStartDate;
                }

                if (startDate === null) {
                    throw new Error('start date cannot be null');
                }

                if (endDate === null) {
                    throw new Error('end date cannot be null');
                }

                const equalCycle = allCycles.find((data) => {
                    if (data.cycle === cycle && data.startDate === startDate && data.endDate === endDate) {
                        return true;
                    }
                });

                if (equalCycle) {
                    const hasGroup = equalCycle.groups.find(g => g.id === group.id);
                    if (!hasGroup) {
                        equalCycle.groups.push(group);
                    }
                }
                else {
                    allCycles.push({ cycle, startDate, endDate, groups: [group] });
                }
            };

            const cycleSettings = group.settings.cycleSettings ?? new Map<number, CycleInformation>();

            cycleSettings.set(cycle, CycleInformation.create({ startDate, endDate }));

            if (cycleSettings.size) {
                console.log('Group: ' + group.id + ' - ' + group.settings.name);
                const correctedCycleSettings = await correctCycleSettings(group.id, group.settings.cycleSettings, startDate, endDate, group.cycle);
                for (const entry of correctedCycleSettings.entries()) {
                    const currentCycle: number = entry[0];
                    const { startDate, endDate } = entry[1];
                    addCycle(currentCycle, startDate, endDate);
                }
            }
        }

        if (allCycles.length === 0) {
            // first check if already has a registration period for the organization
            const registrationPeriod = await RegistrationPeriod.getByID(organization.periodId); ;
            if (registrationPeriod && registrationPeriod.organizationId === organization.id) {
                continue;
            }

            // create new registration period, every organization should have a registration period with an organization id
            const period = await createRegistrationPeriod({
                organization,
                startDate: new Date(2025, 0, 1, 0, 0, 0, 0),
                endDate: new Date(2025, 11, 31, 59, 59, 59, 999),
            }, dryRun);

            organization.periodId = period.id;

            if (!dryRun) {
                await organization.save();
            }
            continue;
        }

        const cycleGroups = groupCycles(allCycles);

        cycleGroups.forEach((g) => {
            if (g.startDate === null || g.endDate === null) {
                throw new Error(`(${organization.name}) - Grouped startDate (${Formatter.date(g.startDate, true)}) or endDate (${Formatter.date(g.endDate, true)}) is null`);
            }

            if (g.startDate > g.endDate) {
                throw new Error(`(${organization.name}) - Grouped startDate (${Formatter.date(g.startDate, true)}) is after endDate (${Formatter.date(g.endDate, true)})`);
            }
        });

        try {
            await migrateCycleGroups(cycleGroups, organization, dryRun);
        }
        catch (e) {
            console.error(JSON.stringify(cycleGroups.map((cg) => {
                return {
                    startDate: cg.startDate.getTime(),
                    endDate: cg.endDate.getTime(),
                    groups: cg.cycles.flatMap(c => c.groups.map(g => g.id)),
                };
            })));
            console.error(e);
            throw e;
        }

        await cleanupCycleGroups(cycleGroups, dryRun);
    }
}

async function cleanupCycleGroups(cycleGroups: CycleGroup[], dryRun: boolean) {
    for (const group of cycleGroups.flatMap(cg => cg.cycles.flatMap(c => c.groups))) {
        await cleanupGroup(group, dryRun);
    }
}

async function cleanupGroup(group: Group, dryRun: boolean) {
    group.settings.cycleSettings = new Map();
    group.cycle = cycleIfMigrated;
    if (group.status === GroupStatus.Archived) {
        group.status = GroupStatus.Closed;
    }

    if (!dryRun) {
        await group.updateOccupancy();
        await group.save();
    }
}

function sortCycles(cycles: CycleData[]) {
    cycles.sort((a, b) => {
        if (a.startDate && b.startDate) {
            return a.startDate.getTime() - b.startDate.getTime();
        }
        if (a.startDate === null && b.startDate === null) {
            return 0;
        }

        if (a.startDate) {
            return -1;
        }
        return 1;
    });
}

type CycleGroup = {
    startDate: Date;
    endDate: Date;
    cycles: CycleData[];
};

async function migrateCycleGroups(cycleGroups: CycleGroup[], organization: Organization, dryRun: boolean) {
    let previousPeriod: RegistrationPeriod | null = null;

    const originalCategories = organization.meta.categories;
    const originalRootCategoryId = organization.meta.rootCategoryId;

    if (originalRootCategoryId === '') {
        throw new Error('Original root category is empty');
    }

    for (let i = 0; i < cycleGroups.length; i++) {
        const cycleGroup = cycleGroups[i];

        // create registration period
        const locked = cycleGroup.endDate.getFullYear() < new Date().getFullYear();
        const period = await createRegistrationPeriod({
            startDate: cycleGroup.startDate,
            endDate: cycleGroup.endDate,
            locked,
            previousPeriodId: previousPeriod ? previousPeriod.id : undefined,
            organization,
        }, dryRun);

        if (i === 0) {
            organization.periodId = period.id;

            if (!dryRun) {
                await organization.save();
            }
        }

        previousPeriod = period;

        const organizationRegistrationPeriod = await createOrganizationRegistrationPeriod({
            organization,
            period,
        }, dryRun);

        const allGroups: { group: Group; originalGroup: Group; cylcleData: CycleData }[] = [];
        const newGroups: Group[] = [];

        // create group for each group in cycleGroup
        for (const cycle of cycleGroup.cycles) {
            for (const group of cycle.groups) {
                if (cycle.cycle === group.cycle) {
                    group.periodId = period.id;

                    if (group.settings.startDate.getTime() !== cycleGroup.startDate.getTime()) {
                        group.settings.startDate = cycleGroup.startDate;
                    }

                    if (group.settings.endDate.getTime() !== cycleGroup.endDate.getTime()) {
                        group.settings.endDate = cycleGroup.endDate;
                    }

                    if (!dryRun) {
                        await group.save();
                    }

                    allGroups.push({ group, originalGroup: group, cylcleData: cycle });
                }
                else {
                    const newGroup = cloneGroup(cycle, group, period);
                    if (!dryRun) {
                        await newGroup.save();
                    }
                    newGroups.push(newGroup);
                    allGroups.push({ group: newGroup, originalGroup: group, cylcleData: cycle });
                }
            }
        }

        // update registrations
        for (const { group, originalGroup, cylcleData } of allGroups) {
            let waitingList: Group | null = null;

            const getOrCreateWaitingList = async () => {
                if (group.waitingListId !== null && group.waitingListId !== undefined) {
                    if (waitingList !== null) {
                        return waitingList;
                    }
                    const fetchedWaitingList = await Group.getByID(group.waitingListId);

                    if (!fetchedWaitingList) {
                        throw new Error(`Waiting list not found: (waitingListId: ${group.waitingListId}, groupId: ${group.id})`);
                    }
                }

                const newWaitingList = new Group();
                newWaitingList.cycle = cycleIfMigrated;
                newWaitingList.type = GroupType.WaitingList;
                newWaitingList.organizationId = organization.id;
                newWaitingList.periodId = period.id;
                newWaitingList.settings = GroupSettings.create({
                    name: TranslatedString.create($t(`c1f1d9d0-3fa1-4633-8e14-8c4fc98b4f0f`) + ' ' + originalGroup.settings.name.toString()),
                });

                if (!dryRun) {
                    await newWaitingList.save();
                }

                waitingList = newWaitingList;
                return newWaitingList;
            };

            const registrations = await Registration.select()
                .where('groupId', originalGroup.id)
                .andWhere('cycle', cylcleData.cycle)
                .fetch();

            for (const registration of registrations) {
                if (registration.waitingList) {
                    const waitingList = await getOrCreateWaitingList();
                    if (group.waitingListId !== waitingList.id) {
                        group.waitingListId = waitingList.id;

                        if (!dryRun) {
                            await group.save();
                        }
                    }

                    registration.groupId = waitingList.id;
                }
                else {
                    registration.groupId = group.id;
                }

                registration.periodId = period.id;
                registration.cycle = cylcleData.cycle;

                if (!dryRun) {
                    await registration.save();
                }
            }
        }

        const archivedGroupIds = allGroups.filter(g => g.group.status === GroupStatus.Archived).map(g => g.group.id);
        const hasArchivedGroups = archivedGroupIds.length > 0;

        const archiveCategory = GroupCategory.create({
            settings: GroupCategorySettings.create({
                name: 'Archief',
                description: 'Gearchiveerde groepen',
                public: false,
            }),
            groupIds: [...archivedGroupIds],
        });

        const newCategoriesData = originalCategories.map((c) => {
            const category = GroupCategory.create({
                settings: GroupCategorySettings.create({
                    ...c.settings,
                }),
                groupIds: [...new Set(c.groupIds.flatMap((oldId) => {
                    const result = allGroups.find(g => g.originalGroup.id === oldId);
                    if (result) {
                        if (result.group.status === GroupStatus.Archived) {
                            return [];
                        }
                        return [result.group.id];
                    }
                    return [];
                }))],
            });
            return {
                category,
                originalCategory: c,
            };
        });

        newCategoriesData.forEach((c) => {
            const newCategoryIds = [...new Set(c.originalCategory.categoryIds.flatMap((id) => {
                const result = newCategoriesData.find(c => c.originalCategory.id === id);
                if (result) {
                    return [result.category.id];
                }
                return [];
            }))];
            c.category.categoryIds = newCategoryIds;
        });

        const rootCategoryData = newCategoriesData.find(c => c.originalCategory.id === originalRootCategoryId);
        if (!rootCategoryData) {
            throw new Error('No root category found');
        }
        organizationRegistrationPeriod.settings.rootCategoryId = rootCategoryData.category.id;

        organizationRegistrationPeriod.settings.categories = newCategoriesData.map(c => c.category).concat(hasArchivedGroups ? [archiveCategory] : []);

        if (organizationRegistrationPeriod.settings.categories.length === 0) {
            throw new Error('No categories found');
        }

        if (!dryRun) {
            await organizationRegistrationPeriod.save();
        }
    }
}

function cloneGroup(cycle: CycleData, group: Group, period: RegistrationPeriod) {
    const newGroup = new Group();
    newGroup.organizationId = group.organizationId;
    newGroup.periodId = period.id;
    newGroup.status = group.status;
    newGroup.createdAt = group.createdAt;
    newGroup.deletedAt = group.deletedAt;

    // todo: should group ids in permissions get updated?
    newGroup.privateSettings = GroupPrivateSettings.create({
        ...group.privateSettings,
    });

    newGroup.cycle = cycleIfMigrated;

    const newSettings = GroupSettings
        .create({
            ...group.settings,
            cycleSettings: new Map(),
            startDate: cycle.startDate ?? undefined,
            endDate: cycle.endDate ?? undefined,
        });

    newGroup.settings = newSettings;
    newGroup.type = group.type;

    return newGroup;
}

export default new Migration(async () => {
    if (1 === 1) {
        const users = await User.select().where('email', 'admin@test.be').fetch();

        console.log('users:', users.length);

        if (users.length < 10) {
            for (const user of users) {
                await user.delete();
            }
        }

        await new UserFactory({
            email: 'admin@test.be',
            password: 'stamhoofd',
            // permissions: Permissions.create({ level: PermissionLevel.Full }),
            globalPermissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();

        throw new Error('test');
    }

    if (STAMHOOFD.environment === 'test') {
        console.log('skipped in tests');
        return;
    }

    if (STAMHOOFD.platformName.toLowerCase() !== 'stamhoofd') {
        console.log('skipped for platform (only runs for Stamhoofd): ' + STAMHOOFD.platformName);
        return;
    }

    const dryRun = false;
    await startGroupCyclesToPeriodsMigration(dryRun);

    if (dryRun) {
        throw new Error('Migration did not finish because of dryRun');
    }
});

function differenceInDays(date1: Date, date2: Date) {
    const diffTime = Math.abs(date2.getTime() - date1.getTime());
    return timeToDays(diffTime);
}

function timeToDays(time: number): number {
    return Math.ceil(time / (1000 * 60 * 60 * 24));
}

type PeriodSpan = {
    startMonth: number;
    span: number;
};

function getPeriodSpans() {
    const results: PeriodSpan[] = [];
    const monthSpans: number[] = [12, 6];

    for (const monthSpan of monthSpans) {
        for (let i = 0; i < monthSpan; i++) {
            results.push({ startMonth: i, span: monthSpan });
        }
    }

    return results;
}

const periodSpans = getPeriodSpans();
const defaultPeriodSpan = periodSpans.find(periodSpan => periodSpan.span === 12 && periodSpan.startMonth === 8)!;

function findBestPeriodMatch(cyclePeriod: { startDate: Date; endDate: Date }): PeriodSpan {
    // best match = most days overlap and least days missing
    const startYear = cyclePeriod.startDate.getFullYear();
    const endYear = cyclePeriod.endDate.getFullYear();

    const yearsToLoop = new Set([startYear - 1, startYear, endYear, endYear + 1]);
    const cycleInfo = {
        startDate: cyclePeriod.startDate,
        endDate: cyclePeriod.endDate,
    };

    let bestMatch: {
        periodSpan: PeriodSpan;
        daysMissing: number;
        daysOverlapping: number;
    } | null = null;

    for (const periodSpan of periodSpans) {
        const repeat = 12 / periodSpan.span;

        for (let i = 0; i < repeat; i++) {
            const startMonth = i * periodSpan.span + periodSpan.startMonth;

            for (const year of yearsToLoop) {
                const { daysMissing, daysOverlapping } = getDaysMissingAndOverlap(
                    cycleInfo,
                    {
                        startDate: new Date(year, startMonth, 1),
                        endDate: new Date(new Date(year, startMonth + periodSpan.span, 1).getTime() - 1),
                    },
                );

                if (bestMatch === null) {
                    bestMatch = {
                        periodSpan,
                        daysMissing,
                        daysOverlapping,
                    };
                    continue;
                }

                if (daysOverlapping < 0) {
                    continue;
                }

                if (daysOverlapping > bestMatch.daysOverlapping) {
                    bestMatch = {
                        periodSpan,
                        daysMissing,
                        daysOverlapping,
                    };
                    continue;
                }

                if (daysOverlapping === bestMatch.daysOverlapping && daysMissing < bestMatch.daysMissing) {
                    bestMatch = {
                        periodSpan,
                        daysMissing,
                        daysOverlapping,
                    };
                    continue;
                }
            }
        }
    }

    if (bestMatch) {
        return bestMatch.periodSpan;
    }

    return periodSpans[0];
}

function groupCycles(cycles: CycleData[]): CycleGroup[] {
    // #region separate short and long cycles
    const shortCycles: CycleData[] = [];
    const longCycles: CycleData[] = [];

    for (const cycle of cycles) {
        const { startDate, endDate } = cycle;
        if (startDate && endDate && differenceInDays(startDate, endDate) < 150) {
            shortCycles.push(cycle);
        }
        else {
            longCycles.push(cycle);
        }
    }

    sortCycles(longCycles);
    sortCycles(shortCycles);
    // #endregion

    // search the best period span
    const periodSpanCounts = new Map<PeriodSpan, { count: number; cycles: CycleData[] }>();
    let topPeriodSpan: PeriodSpan = defaultPeriodSpan;
    let topCount: number = 0;

    for (const cycle of longCycles) {
        if (cycle.startDate && cycle.endDate) {
            // month start, month end, span
            const bestPeriod = findBestPeriodMatch({
                startDate: cycle.startDate,
                endDate: cycle.endDate });

            const mapValue = periodSpanCounts.get(bestPeriod);
            const currentCount = mapValue?.count ?? 0;
            const currentCycles = mapValue?.cycles ?? [];
            currentCycles.push(cycle);
            const newCount = currentCount + 1;
            if (newCount > topCount) {
                topCount = newCount;
                topPeriodSpan = bestPeriod;
            }
            periodSpanCounts.set(bestPeriod, { count: newCount, cycles: currentCycles });
        }
    }

    if (topCount === 0) {
        console.log('take default period span');
    }

    // group the cycles in periods
    const results = new Map<
        // year and month
        string,
        CycleData[]>();

    for (const cycle of cycles) {
        const yearAndMonth = getYearAndMonthForCycle({ startDate: cycle.startDate, endDate: cycle.endDate }, topPeriodSpan);

        if (results.has(yearAndMonth)) {
            const cyclesInYear = results.get(yearAndMonth)!;
            cyclesInYear.push(cycle);
        }
        else {
            results.set(yearAndMonth, [cycle]);
        }
    }

    // create the groups
    const groups: CycleGroup[] = [...results.entries()].map(([yearAndMonth, cycles]) => {
        const [year, month] = yearAndMonth.split('-').map(v => parseInt(v));
        const startDate = new Date(year, month, 1);
        const endDate = new Date(new Date(year, month + topPeriodSpan.span, 1).getTime() - 1);

        return {
            startDate,
            endDate,
            cycles,
        };
    });

    return groups;
}

/**
 * returns the number of days that the periods overlap and the number of days that are missing from the longest period
 * @param period
 * @param targetPeriod
 */
export function getDaysMissingAndOverlap(period1: { startDate: Date; endDate: Date }, period2: { startDate: Date; endDate: Date }): { daysMissing: number; daysOverlapping: number; longestPeriodInDays: number } {
    const totalDays1 = differenceInDays(period1.startDate, period1.endDate);
    const totalDays2 = differenceInDays(period2.startDate, period2.endDate);

    const targetPeriod = totalDays1 > totalDays2 ? period1 : period2;
    const otherPeriod = totalDays1 > totalDays2 ? period2 : period1;

    const startOverlap = targetPeriod.startDate.getTime() > otherPeriod.startDate.getTime() ? targetPeriod.startDate : otherPeriod.startDate;
    const endOverlap = targetPeriod.endDate.getTime() < otherPeriod.endDate.getTime() ? targetPeriod.endDate : otherPeriod.endDate;

    const daysOverlapping = startOverlap.getTime() > endOverlap.getTime() ? 0 : differenceInDays(startOverlap, endOverlap);

    const daysMissing = totalDays1 > totalDays2 ? totalDays1 - daysOverlapping : totalDays2 - daysOverlapping;

    return {
        daysMissing,
        daysOverlapping,
        longestPeriodInDays: totalDays1 > totalDays2 ? totalDays1 : totalDays2,
    };
}

function getYearAndMonthForCycle({ startDate, endDate }: { startDate: Date; endDate: Date }, periodSpan: PeriodSpan): string {
    // best match = most days overlap and least days missing
    const startYear = startDate.getFullYear();
    const endYear = endDate.getFullYear();
    const yearsToLoop = new Set([startYear - 1, startYear, endYear, endYear + 1]);

    const cycleInfo = {
        startDate,
        endDate,
    };

    let bestMatch: {
        year: number;
        month: number;
        daysMissing: number;
        daysOverlapping: number;
    } | null = null;

    const repeat = 12 / periodSpan.span;

    for (let i = 0; i < repeat; i++) {
        const startMonth = i * periodSpan.span + periodSpan.startMonth;

        for (const year of yearsToLoop) {
            const { daysMissing, daysOverlapping } = getDaysMissingAndOverlap(cycleInfo, {
                startDate: new Date(year, startMonth, 1),
                endDate: new Date(new Date(year, startMonth + periodSpan.span, 1).getTime() - 1),
            });

            if (bestMatch === null) {
                bestMatch = {
                    year,
                    month: startMonth,
                    daysMissing,
                    daysOverlapping,
                };
                continue;
            }

            if (daysOverlapping < 0) {
                continue;
            }

            if (daysOverlapping > bestMatch.daysOverlapping) {
                bestMatch = {
                    year,
                    month: startMonth,
                    daysMissing,
                    daysOverlapping,
                };
                continue;
            }

            if (daysOverlapping === bestMatch.daysOverlapping && daysMissing < bestMatch.daysMissing) {
                bestMatch = {
                    year,
                    month: startMonth,
                    daysMissing,
                    daysOverlapping,
                };
                continue;
            }
        }
    }

    const { year, month } = bestMatch!;
    return `${year}-${month}`;
}

async function createOrganizationRegistrationPeriod(options: {
    organization: Organization;
    period: RegistrationPeriod;
}, dryRun: boolean) {
    const organizationRegistrationPeriod = new OrganizationRegistrationPeriod();

    organizationRegistrationPeriod.organizationId = options.organization.id;
    organizationRegistrationPeriod.periodId = options.period.id;

    if (!dryRun) {
        await organizationRegistrationPeriod.save();
    }

    return organizationRegistrationPeriod;
}

async function createRegistrationPeriod(options: {
    startDate?: Date;
    endDate?: Date;
    previousPeriodId?: string;
    locked?: boolean;
    organization?: Organization;
}, dryRun: boolean) {
    const period = new RegistrationPeriod();

    period.organizationId = options.organization ? options.organization.id : null;
    period.startDate = options.startDate ?? new Date(2024, 0, 1, 0, 0, 0, 0);
    period.endDate = options.endDate ?? new Date(2024, 11, 31, 59, 59, 59, 999);
    if (options.previousPeriodId) {
        period.previousPeriodId = options.previousPeriodId;
    }
    period.settings = RegistrationPeriodSettings.create({});
    period.locked = options.locked ?? false;

    if (!dryRun) {
        await period.save();
    }

    return period;
}
