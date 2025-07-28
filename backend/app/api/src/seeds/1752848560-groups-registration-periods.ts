import { Migration } from '@simonbackx/simple-database';
import { Group, Organization } from '@stamhoofd/models';
import { Formatter } from '@stamhoofd/utility';

type CycleData = {
    cycle: number;
    startDate: Date | null;
    endDate: Date | null;
    groups: Group[];
};

export async function startGroupCyclesToPeriodsMigration() {
    for await (const organization of Organization.select().all()) {
        // if (organization.name !== 'Osta Berchem VC') {
        //     continue;
        // }

        const allCycles: CycleData[] = [];

        const groups = await Group.select().where('organizationId', organization.id).fetch();

        for (const group of groups) {
            const cycle: number = group.cycle;
            const startDate: Date = group.settings.startDate;
            const endDate: Date = group.settings.endDate;

            const addCycle = (cycle: number, startDate: Date | null, endDate: Date | null) => {
                if (endDate && startDate && endDate < startDate) {
                    // todo
                    return;
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

            if (cycle > 0 && group.settings.cycleSettings && group.settings.cycleSettings.size) {
                for (const entry of group.settings.cycleSettings.entries()) {
                    const currentCycle: number = entry[0];
                    const cycleSettings = entry[1];
                    const cycleStartDate: Date | null = cycleSettings.startDate;
                    const cycleEndDate: Date | null = cycleSettings.endDate;
                    addCycle(currentCycle, cycleStartDate, cycleEndDate);
                }
            }
        }

        if (allCycles.length === 0) {
            // todo?
            // console.log('No groups found: ', groups.length);
            continue;
        }

        const cycleGroups = groupCycles(allCycles);

        cycleGroups.forEach((g) => {
            if (g.startDate > g.endDate) {
                throw new Error(`(${organization.name}) - Grouped startDate (${Formatter.date(g.startDate, true)}) is after endDate (${Formatter.date(g.endDate, true)})`);
            }
        });

        try {
            validateCycleGroups(cycleGroups);
        }
        catch (e) {
            console.log('Organization: ' + organization.name);
            console.error(e);
        }
    }

    throw new Error('wip todo');
}

function validateCycleGroups(groups: CycleGroup[]) {
    const groupsString = groups.slice().reverse().map(c => `${c.startDate ? Formatter.date(c.startDate, true) : 'null'} - ${c.endDate ? Formatter.date(c.endDate, true) : 'null'}`).join(', ');

    for (let i = 0; i < groups.length - 1; i++) {
        const group = groups[i];
        const isFirst = i === 0;
        const isLast = i === groups.length - 1;

        for (const cycle of group.cycles) {
            if (cycle.startDate && cycle.startDate < group.startDate && differenceInDays(cycle.startDate, group.startDate) > 90) {
                throw new Error(`cycle (${Formatter.date(cycle.startDate, true)} - ${cycle.endDate ? Formatter.date(cycle.endDate, true) : 'null'}) is outside of group (${Formatter.date(group.startDate, true)} - ${Formatter.date(group.endDate, true)}) (isFirst: ${isFirst}, isLast: ${isLast}, groups: ${groupsString})`);
            }

            if (cycle.endDate && cycle.endDate > group.endDate && differenceInDays(cycle.endDate, group.endDate) > 90) {
                throw new Error(`cycle (${cycle.startDate ? Formatter.date(cycle.startDate, true) : 'null'} - ${cycle.endDate ? Formatter.date(cycle.endDate, true) : 'null'}) is outside of group (${Formatter.date(group.startDate, true)} - ${Formatter.date(group.endDate, true)}) (isFirst: ${isFirst}, isLast: ${isLast}, groups: ${groupsString})`);
            }
        }
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
            throw new Error('No startDate found, todo');
        }
        // todo
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
        // todo
        throw new Error('no groups found');
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

export default new Migration(async () => {
    console.error('test groups-registration-periods');
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
