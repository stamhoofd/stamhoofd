import { Migration } from '@simonbackx/simple-database';
import { Group, Organization, OrganizationRegistrationPeriodFactory, Registration, RegistrationPeriod, RegistrationPeriodFactory } from '@stamhoofd/models';
import { CycleInformation, GroupCategory, GroupCategorySettings, GroupPrivateSettings, GroupSettings, GroupStatus, GroupType, TranslatedString } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

type CycleData = {
    cycle: number;
    startDate: Date | null;
    endDate: Date | null;
    groups: Group[];
};

const cycleIfMigrated = -99;

function nullIfInvalidDate(date: Date) {
    // some dates are very old and this throws an error otherwise
    if (date.getFullYear() < 1950) {
        return null;
    }
    return date;
}

function limitDate(date: Date): Date {
    // some dates are very old and this throws an error otherwise
    if (date.getFullYear() < 1950) {
        return new Date(1950, date.getMonth(), date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds());
    }
    return date;
}

/**
 * Often cycle settings contains information about various cycles without start and end date.
 * Therefore a good start and end date should be calculated.
 */
function convertCycleSettings(cycleSettings: Map<number, CycleInformation>, startDate: Date, endDate: Date): Map<number, CycleInformation> {
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

    // reversed
    array.sort((a, b) => b.cycle - a.cycle);

    let lastStartDate: Date | null = nullIfInvalidDate(startDate);
    let lastEndDate: Date | null = nullIfInvalidDate(endDate);

    for (let i = 0; i < array.length; i++) {
        const item = array[i];

        if (item.settings.startDate !== null) {
            lastStartDate = item.settings.startDate;
        }
        else {
            if (lastEndDate !== null && lastStartDate !== null) {
                const dayDifference = differenceInDays(lastStartDate, lastEndDate);

                const years = Math.ceil(dayDifference / 366);

                const newStartDate = new Date(lastStartDate.getTime());
                newStartDate.setFullYear(newStartDate.getFullYear() - years);
                item.settings.startDate = newStartDate;
                lastStartDate = newStartDate;

                // const isMostRecent = i === 0;

                // if (!isMostRecent && item.settings.endDate === null) {
                //     if (lastEndDate === null) {
                //         throw new Error('Cannot calculate new end date');
                //     }
                //     const newEndDate = new Date(lastStartDate.getTime() - 1);
                //     item.settings.endDate = newEndDate;
                // }
            }
            else {
                throw new Error('Cannot calculate new start date');
            }
        }

        if (item.settings.endDate !== null) {
            lastEndDate = item.settings.endDate;
        }
        else {
            const isOldest = i === array.length - 1;
            if (isOldest) {
                continue;
            }

            if (lastStartDate !== null) {
                const newEndDate = new Date(lastStartDate.getTime() - 1);
                item.settings.endDate = newEndDate;
            }
            else {
                // todo
                throw Error('test todo');
            }
        }
    }

    return new Map([...array].reverse().map(item => [item.cycle, item.settings]));
}

export async function startGroupCyclesToPeriodsMigration() {
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

            const addCycle = (cycle: number, startDate: Date | null, endDate: Date | null) => {
                if (endDate && startDate && endDate < startDate) {
                    // switch start and end dates
                    const originalStartDate = startDate;
                    const originalEndDate = endDate;
                    startDate = originalEndDate;
                    endDate = originalStartDate;
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

            addCycle(cycle, startDate, endDate);

            if (group.settings.cycleSettings && group.settings.cycleSettings.size) {
                console.log('Group: ' + group.id + ' - ' + group.settings.name);
                for (const entry of convertCycleSettings(group.settings.cycleSettings, startDate, endDate).entries()) {
                    const currentCycle: number = entry[0];
                    const cycleSettings = entry[1];
                    const cycleStartDate: Date | null = cycleSettings.startDate ? limitDate(cycleSettings.startDate) : null;
                    const cycleEndDate: Date | null = cycleSettings.endDate ? limitDate(cycleSettings.endDate) : null;
                    addCycle(currentCycle, cycleStartDate, cycleEndDate);
                }
            }
        }

        if (allCycles.length === 0) {
            // todo: should add period?
            // throw new Error('No cycles found for organization: ' + organization.name);
            continue;
        }

        const cycleGroups = groupCycles(allCycles);

        cycleGroups.forEach((g) => {
            if (g.startDate > g.endDate) {
                throw new Error(`(${organization.name}) - Grouped startDate (${Formatter.date(g.startDate, true)}) is after endDate (${Formatter.date(g.endDate, true)})`);
            }
        });

        try {
            await migrateCycleGroups(cycleGroups, organization);
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

        await cleanupCycleGroups(cycleGroups);
    }
}

async function cleanupCycleGroups(cycleGroups: CycleGroup[]) {
    for (const group of cycleGroups.flatMap(cg => cg.cycles.flatMap(c => c.groups))) {
        await cleanupGroup(group);
    }
}

async function cleanupGroup(group: Group) {
    group.settings.cycleSettings = new Map();
    group.cycle = cycleIfMigrated;
    await group.save();
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

function groupCycles(cycles: CycleData[]): CycleGroup[] {
    const shortCycles: CycleData[] = [];
    const longCycles: CycleData[] = [];

    for (const cycle of cycles) {
        const { startDate, endDate } = cycle;
        if (startDate && endDate && differenceInDays(startDate, endDate) < 240) {
            shortCycles.push(cycle);
        }
        else {
            longCycles.push(cycle);
        }
    }

    sortCycles(longCycles);
    sortCycles(shortCycles);

    let startDate = longCycles.find(a => a.startDate !== null)?.startDate;
    if (!startDate) {
        startDate = shortCycles.find(a => a.startDate !== null)?.startDate;
        if (!startDate) {
            throw new Error('No startDate found');
        }
    }

    let currentGroup: {
        startDate: Date;
        cycles: CycleData[];

    } = { startDate,
        cycles: [] };

    const groupsWithStart: {
        startDate: Date;
        cycles: CycleData[];
    }[] = [currentGroup];
    const skippedCycles: CycleData[] = [];

    for (const cycle of longCycles) {
        if (!cycle.startDate) {
            skippedCycles.push(cycle);
            continue;
        }

        const dayDifference = differenceInDays(startDate, cycle.startDate);

        if (dayDifference < 150) {
            currentGroup.cycles.push(cycle);
        }
        else {
            startDate = cycle.startDate;
            currentGroup = { startDate, cycles: [cycle] };
            groupsWithStart.push(currentGroup);
        }
    }

    let lastStartDate: Date | null = null;

    const groupsWithStartAndEnd: CycleGroup[] = [];

    for (const group of groupsWithStart.slice().reverse()) {
        let endDate: Date;

        if (lastStartDate) {
            endDate = getDateBefore(lastStartDate);
        }
        else {
            endDate = getDefaultEndDate(group.startDate, group.cycles);
        }

        groupsWithStartAndEnd.push({ startDate: group.startDate, endDate, cycles: group.cycles });
        lastStartDate = group.startDate;
    }

    if (groupsWithStartAndEnd.length === 0) {
        const startDates = shortCycles.map(a => a.startDate).filter(a => a !== null).map(a => a!.getTime());
        const endDates = shortCycles.map(a => a.endDate).filter(a => a !== null).map(a => a!.getTime());

        if (startDates.length === 0 || endDates.length === 0) {
            throw new Error('No cycle with start and end date found.');
        }

        groupsWithStartAndEnd.push({
            startDate: new Date(Math.min(...startDates)),
            cycles: shortCycles,
            endDate: new Date(Math.max(...endDates)),
        });
    }

    let groupAddedBefore: CycleGroup | null = null;
    let groupAddedAfter: CycleGroup | null = null;

    const getNewestGroup = () => {
        return groupsWithStartAndEnd[0];
    };

    const getOldestGroup = () => {
        return groupsWithStartAndEnd[groupsWithStartAndEnd.length - 1];
    };

    for (const cycleToAdd of [...shortCycles, ...skippedCycles]) {
        const bestGroupMatch = selectBestGroup(cycleToAdd, groupsWithStartAndEnd);

        // if null => outside of existing cycles => add new one before or after
        if (bestGroupMatch === null) {
            const oldestGroup = getOldestGroup();
            let isBefore = false;

            if (cycleToAdd.endDate && cycleToAdd.endDate < oldestGroup.startDate) {
                isBefore = true;
            }
            else if (cycleToAdd.startDate && cycleToAdd.startDate < oldestGroup.startDate) {
                if (!groupAddedBefore && differenceInDays(cycleToAdd.startDate, oldestGroup.startDate) < 90) {
                    oldestGroup.startDate = cycleToAdd.startDate;
                    oldestGroup.cycles.push(cycleToAdd);
                    continue;
                }
                isBefore = true;
            }

            if (isBefore) {
                if (groupAddedBefore) {
                    if (cycleToAdd.startDate && cycleToAdd.startDate < groupAddedBefore.startDate) {
                        groupAddedBefore.startDate = cycleToAdd.startDate;
                    }

                    groupAddedBefore.cycles.push(cycleToAdd);
                }
                else {
                    const newEndDate = getDateBefore(oldestGroup.startDate);
                    let newStartDate = cycleToAdd.startDate;
                    if (!newStartDate) {
                        newStartDate = new Date(oldestGroup.startDate);
                        newStartDate.setFullYear(newStartDate.getFullYear() - 1);
                    }

                    const newGroup: CycleGroup = { startDate: newStartDate, endDate: newEndDate, cycles: [cycleToAdd] };
                    groupAddedBefore = newGroup;
                    groupsWithStartAndEnd.push(newGroup);
                }
            }
            else {
                if (groupAddedAfter) {
                    if (cycleToAdd.endDate && cycleToAdd.endDate > groupAddedAfter.endDate) {
                        groupAddedAfter.endDate = cycleToAdd.endDate;
                    }

                    groupAddedAfter.cycles.push(cycleToAdd);
                }
                else {
                    const newestGroup = getNewestGroup();
                    const newStartDate = getDateAfter(newestGroup.endDate);
                    let newEndDate = cycleToAdd.endDate;
                    if (!newEndDate) {
                        newEndDate = new Date(newestGroup.endDate);
                        newEndDate.setFullYear(newEndDate.getFullYear() + 1);
                    }

                    const newGroup: CycleGroup = { startDate: newStartDate, endDate: newEndDate, cycles: [cycleToAdd] };
                    groupAddedAfter = newGroup;
                    groupsWithStartAndEnd.unshift(newGroup);
                }
            }
        }
        else {
            bestGroupMatch.cycles.push(cycleToAdd);
        }
    }

    const newestGroup = getNewestGroup();
    for (const cycle of newestGroup.cycles) {
        if (cycle.endDate && cycle.endDate > newestGroup.endDate) {
            newestGroup.endDate = cycle.endDate;
        }
    }
    const oldestGroup = getOldestGroup();
    for (const cycle of oldestGroup.cycles) {
        if (cycle.startDate && cycle.startDate < oldestGroup.startDate) {
            oldestGroup.startDate = cycle.startDate;
        }
    }

    return groupsWithStartAndEnd;
}

function selectBestGroup(cycle: CycleData, groupsWithStartAndEnd: {
    startDate: Date;
    endDate: Date;
    cycles: CycleData[];
}[]): {
    startDate: Date;
    endDate: Date;
    cycles: CycleData[];
} | null {
    const { startDate, endDate } = cycle;

    if (startDate !== null && endDate !== null) {
        let result: {
            startDate: Date;
            endDate: Date;
            cycles: CycleData[];
        } | null = null;
        let biggestOverlap = 0;

        for (const group of groupsWithStartAndEnd) {
            let start: Date;
            let end: Date;

            if (startDate > group.endDate || endDate < group.startDate) {
                continue;
            }

            if (startDate >= group.startDate) {
                start = startDate;
            }
            else {
                start = group.startDate;
            }

            if (endDate <= group.endDate) {
                end = endDate;
            }
            else {
                end = group.endDate;
            }

            const overlap = differenceInDays(start, end);

            if (overlap > biggestOverlap) {
                biggestOverlap = overlap;
                result = group;
            }
            else if (result === null) {
                result = group;
            }
        }

        return result;
    }

    if (endDate !== null) {
        const group = groupsWithStartAndEnd.find((g) => {
            if (endDate >= g.startDate && endDate <= g.endDate) {
                return true;
            }
            return false;
        });

        return group ?? null;
    }

    if (startDate !== null) {
        const group = groupsWithStartAndEnd.find((g) => {
            if (startDate >= g.startDate && startDate <= g.endDate) {
                return true;
            }
            return false;
        });

        return group ?? null;
    }

    return groupsWithStartAndEnd[0];
}

function getDefaultEndDate(startDate: Date, cycleData: CycleData[]) {
    const endTimes = cycleData.filter(g => g.endDate !== null).map(g => g.endDate!.getTime());

    if (endTimes.length === 0) {
        return getEndDateFromStartDate(startDate);
    }

    return new Date(Math.max(...endTimes));
}

function getEndDateFromStartDate(startDate: Date): Date {
    const date = new Date(startDate);
    date.setFullYear(date.getFullYear() + 1);
    return getDateBefore(date);
}

function getDateBefore(date: Date): Date {
    return new Date(date.getTime() - 1);
}

function getDateAfter(date: Date): Date {
    return new Date(date.getTime() + 1);
}

function differenceInDays(date1: Date, date2: Date) {
    const diffTime = Math.abs(date2.getTime() - date1.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
}

async function migrateCycleGroups(cycleGroups: CycleGroup[], organization: Organization) {
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
        const period = await new RegistrationPeriodFactory({
            startDate: cycleGroup.startDate,
            endDate: cycleGroup.endDate,
            locked,
            previousPeriodId: previousPeriod ? previousPeriod.id : undefined,
            organization,
        }).create();

        if (i === 0) {
            organization.periodId = period.id;
            await organization.save();
        }

        previousPeriod = period;

        const organizationRegistrationPeriod = await new OrganizationRegistrationPeriodFactory({
            organization,
            period,
        }).create();

        const allGroups: { group: Group; originalGroup: Group; cylcleData: CycleData }[] = [];
        const newGroups: Group[] = [];

        // create group for each group in cycleGroup
        for (const cycle of cycleGroup.cycles) {
            for (const group of cycle.groups) {
                if (cycle.cycle === group.cycle) {
                    group.periodId = period.id;
                    group.settings.startDate = cycleGroup.startDate;
                    group.settings.endDate = cycleGroup.endDate;

                    await group.save();

                    allGroups.push({ group, originalGroup: group, cylcleData: cycle });
                }
                else {
                    const newGroup = cloneGroup(cycle, group, period);
                    await newGroup.save();
                    newGroups.push(newGroup);
                    allGroups.push({ group: newGroup, originalGroup: group, cylcleData: cycle });
                }
            }
        }

        // update registrations
        for (const { group, originalGroup, cylcleData } of allGroups) {
            let waitingList: Group | null = null;

            const getOrCreateWaitingList = async () => {
                if (group.waitingListId !== null) {
                    if (waitingList !== null) {
                        return waitingList;
                    }
                    const fetchedWaitingList = await Group.getByID(group.waitingListId);

                    if (!fetchedWaitingList) {
                        throw new Error('Waiting list not found');
                    }

                    waitingList = fetchedWaitingList;
                    return fetchedWaitingList;
                }

                const newWaitingList = new Group();
                newWaitingList.cycle = cycleIfMigrated;
                newWaitingList.type = GroupType.WaitingList;
                newWaitingList.organizationId = organization.id;
                newWaitingList.periodId = period.id;
                newWaitingList.settings = GroupSettings.create({
                    name: TranslatedString.create($t(`c1f1d9d0-3fa1-4633-8e14-8c4fc98b4f0f`) + ' ' + originalGroup.settings.name.toString()),
                });

                await newWaitingList.save();

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
                        await group.save();
                    }

                    registration.groupId = waitingList.id;
                }
                else {
                    registration.groupId = group.id;
                }

                registration.periodId = period.id;
                registration.cycle = cylcleData.cycle;
                await registration.save();
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

        await organizationRegistrationPeriod.save();
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
    if (STAMHOOFD.environment === 'test') {
        console.log('skipped in tests');
        return;
    }

    if (STAMHOOFD.platformName.toLowerCase() !== 'stamhoofd') {
        console.log('skipped for platform (only runs for Stamhoofd): ' + STAMHOOFD.platformName);
        return;
    }

    await startGroupCyclesToPeriodsMigration();
});
