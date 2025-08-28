import { Migration } from '@simonbackx/simple-database';
import { Group, Organization, OrganizationRegistrationPeriod, Registration, RegistrationPeriod, User, UserFactory } from '@stamhoofd/models';
import { CycleInformation, GroupCategory, GroupCategorySettings, GroupPrivateSettings, GroupSettings, GroupStatus, GroupType, PermissionLevel, Permissions, RegistrationPeriodSettings, TranslatedString } from '@stamhoofd/structures';

export default new Migration(async () => {
    if (STAMHOOFD.environment === 'test') {
        console.log('skipped in tests');
        return;
    }

    if (STAMHOOFD.platformName.toLowerCase() !== 'stamhoofd') {
        console.log('skipped for platform (only runs for Stamhoofd): ' + STAMHOOFD.platformName);
        return;
    }

    // todo: remove!!!
    if (STAMHOOFD.environment === 'development') {
        // temporary for testing
        await createGlobalAdmin();
    }

    const dryRun = false;
    await start(dryRun);

    if (dryRun) {
        throw new Error('Migration did not finish because of dryRun');
    }
});

async function createGlobalAdmin() {
    const users = await User.select().where('email', 'admin@test.be').fetch();

    if (users.length < 10) {
        for (const user of users) {
            await user.delete();
        }
    }

    await new UserFactory({
        email: 'admin@test.be',
        password: 'stamhoofd',
        globalPermissions: Permissions.create({ level: PermissionLevel.Full }),
    }).create();
}

const cycleIfMigrated = -99;

async function start(dryRun: boolean) {
    for await (const organization of Organization.select().all()) {
        const groups: Group[] = await Group.select().where('organizationId', organization.id).fetch();

        if (groups.length === 0) {
            await createDefaultRegistrationPeriod(organization, dryRun);
            continue;
        }

        if (groups.some(g => g.cycle === cycleIfMigrated)) {
            continue;
        }

        console.log('Organization: ' + organization.name);

        // sort groups by start date
        groups.sort((a, b) => a.settings.startDate.getTime() - b.settings.startDate.getTime());

        const bestCurrentPeriodSpan = await calculateBestCurrentPeriodSpan(groups);

        const allGroups: Group[] = await migrateGroups({ groups, organization, periodSpan: bestCurrentPeriodSpan }, dryRun);

        // cleanup
        for (const group of allGroups) {
            await cleanupGroup(group, dryRun);
        }
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

async function migrateGroups({ groups, organization, periodSpan }: { groups: Group[]; organization: Organization; periodSpan: { startDate: Date; endDate: Date } }, dryRun: boolean) {
    // #region create periods
    const previousYearStartDate = new Date(periodSpan.startDate);
    previousYearStartDate.setFullYear(previousYearStartDate.getFullYear() - 1);

    const archivePeriod = await createRegistrationPeriod({
        // todo: what should be the start date?
        startDate: previousYearStartDate,
        endDate: new Date(periodSpan.startDate.getTime() - 1),
        locked: true,
        organization,
        previousPeriodId: undefined,
    }, dryRun);

    const archiveOrganizationPeriod = await createOrganizationRegistrationPeriod({
        organization,
        period: archivePeriod,
    }, dryRun);

    const currentPeriod = await createRegistrationPeriod({
        startDate: periodSpan.startDate,
        endDate: periodSpan.endDate,
        locked: false,
        previousPeriodId: archivePeriod.id,
        organization,
    }, dryRun);

    organization.periodId = currentPeriod.id;

    if (!dryRun) {
        await organization.save();
    }

    const currentOrganizationRegistrationPeriod = await createOrganizationRegistrationPeriod({
        organization,
        period: currentPeriod,
    }, dryRun);
    // #endregion

    // (to add to categories later)
    const groupMap = new Map<
    // original group id
        string,
        // groups in previous cycles
        Group[]>();

    for (const originalGroup of groups) {
        // archived groups should be migrated to the archive period
        const currentGroupPeriod = originalGroup.status === GroupStatus.Archived ? archivePeriod : currentPeriod;
        const currentCycle = originalGroup.cycle;
        const originalGroupId: string = originalGroup.id;
        originalGroup.periodId = currentGroupPeriod.id;

        // first migrate registrations for the current cycle
        await migrateRegistrations({ organization, period: currentGroupPeriod, originalGroup, newGroup: originalGroup, cycle: currentCycle }, dryRun);

        const cycleSettingEntries = [...originalGroup.settings.cycleSettings.entries()].filter(([cycle]) => {
            return cycle !== currentCycle;
        });

        // most recent cycle first (highest cycle number)
        cycleSettingEntries.sort((a, b) => b[0] - a[0]);

        // create groups for the previous cycles and migrate registrations
        for (let previousPeriodIndex = 0; previousPeriodIndex < cycleSettingEntries.length; previousPeriodIndex++) {
            const [cycle, cycleInformation] = cycleSettingEntries[previousPeriodIndex];
            const newGroup = createPreviousGroup({ originalGroup, period: archivePeriod, cycleInformation, index: previousPeriodIndex });
            if (!dryRun) {
                await newGroup.save();
            }

            await migrateRegistrations({ organization, period: archivePeriod, originalGroup, newGroup, cycle }, dryRun);

            const allPreviousGroups = groupMap.get(originalGroupId);
            if (allPreviousGroups) {
                allPreviousGroups.push(newGroup);
            }
            else {
                groupMap.set(originalGroupId, [newGroup]);
            }
        }
    }

    // #region create categories for current period
    const nonArchivedGroupIds = [...new Set(groups.filter(g => g.status !== GroupStatus.Archived).map(g => g.id))];
    const newCategoriesData = organization.meta.categories.map((c: GroupCategory) => {
        const category = GroupCategory.create({
            settings: GroupCategorySettings.create({
                ...c.settings,
            }),
            groupIds: [...new Set(c.groupIds.filter(id => nonArchivedGroupIds.includes(id)))],
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

    const originalRootCategoryId = organization.meta.rootCategoryId;
    const rootCategoryData = newCategoriesData.find(c => c.originalCategory.id === originalRootCategoryId);
    if (!rootCategoryData) {
        throw new Error('No root category found');
    }

    currentOrganizationRegistrationPeriod.settings.rootCategoryId = rootCategoryData.category.id;

    const currentPeriodCategories = newCategoriesData.map(c => c.category);
    currentOrganizationRegistrationPeriod.settings.categories = currentPeriodCategories;

    if (currentOrganizationRegistrationPeriod.settings.categories.length === 0) {
        throw new Error('No categories found');
    }

    if (!dryRun) {
        await currentOrganizationRegistrationPeriod.save();
    }
    // #endregion

    // #region archived category
    const archivedGroupIds = [...new Set(groups.filter(g => g.status === GroupStatus.Archived).map(g => g.id))];
    const hasArchivedGroups = archivedGroupIds.length > 0;

    const archiveSubCategories = archivedGroupIds.map((originalGroupId) => {
        const originalGroup = groups.find(g => g.id === originalGroupId)!;
        const childGroups = groupMap.get(originalGroupId) ?? [];
        const groupIds = [originalGroup, ...childGroups].map(g => g.id);

        return GroupCategory.create({
            settings: GroupCategorySettings.create({
                name: originalGroup!.settings.name.toString(),
                // todo: is this correct?
                public: false,
                maximumRegistrations: null,
                // todo: should be locked?
            }),
            groupIds,
        });
    });

    const archiveCategory = GroupCategory.create({
        settings: GroupCategorySettings.create({
            name: 'Archief',
            description: 'Gearchiveerde groepen',
            public: false,
        }),
        categoryIds: archiveSubCategories.map(c => c.id),
    });
    // #endregion

    // #region create categories for previous periods
    const allPreviousPeriodCategoriesData: { category: GroupCategory; originalCategory: GroupCategory | null }[] = currentPeriodCategories.flatMap((originalCategory: GroupCategory) => {
        // important: do not set category ids on cloned category yet (because the new category ids are unknown still)
        const clonedCategory = GroupCategory.create({
            settings: GroupCategorySettings.create({
                ...originalCategory.settings,
            }),
        });

        if (originalCategory.groupIds.length) {
            // create category for each original group
            const newCategories = originalCategory.groupIds.flatMap((originalGroupId: string) => {
                const childGroups = groupMap.get(originalGroupId);

                // if(originalCategory)
                if (childGroups && childGroups.length) {
                    const originalGroup = groups.find(g => g.id === originalGroupId)!;
                    const groupIds = childGroups.map(g => g.id);
                    const newCategory = GroupCategory.create({
                        settings: GroupCategorySettings.create({
                            name: originalGroup.settings.name.toString(),
                            // todo: is this correct?
                            public: false,
                            maximumRegistrations: null,
                            // todo: should be locked?
                        }),
                        groupIds,
                    });

                    return [newCategory];
                }

                return [];
            });

            clonedCategory.groupIds = [];
            // set category ids because the ids are correct
            clonedCategory.categoryIds = newCategories.map(c => c.id);

            return [{ category: clonedCategory, originalCategory }, ...newCategories.map(c => ({ category: c, originalCategory: null }))];
        }

        // important: do not set category ids on cloned category yet (because the new category ids are unknown still)
        return [{ category: clonedCategory, originalCategory }];
    });

    // update the category ids
    const allPreviousPeriodCategories = allPreviousPeriodCategoriesData.map((c) => {
        if (!c.originalCategory) {
            return c.category;
        }

        const category = c.category;

        // update category ids, if the category ids are not empty this means the ids are correct already
        if (category.categoryIds.length === 0) {
            category.categoryIds = c.originalCategory.categoryIds.flatMap((originalCategoryId) => {
                const newCategoryData = allPreviousPeriodCategoriesData.find(c => c.originalCategory && c.originalCategory.id === originalCategoryId);
                if (newCategoryData) {
                    return [newCategoryData.category.id];
                }
                return [];
            });
        }

        return category;
    });

    const previousRootCategoryId = currentOrganizationRegistrationPeriod.settings.rootCategoryId;
    const previousRootCategoryData = allPreviousPeriodCategoriesData.find(c => c.originalCategory && c.originalCategory.id === previousRootCategoryId);
    if (!previousRootCategoryData) {
        throw new Error(`No root category found for archive period (${previousRootCategoryId})`);
    }

    // add archive category to root category
    if (hasArchivedGroups) {
        previousRootCategoryData.category.categoryIds.push(archiveCategory.id);
    }

    archiveOrganizationPeriod.settings.rootCategoryId = previousRootCategoryData.category.id;
    archiveOrganizationPeriod.settings.categories = hasArchivedGroups ? [...allPreviousPeriodCategories, archiveCategory, ...archiveSubCategories] : allPreviousPeriodCategories;

    if (archiveOrganizationPeriod.settings.categories.length === 0) {
        throw new Error('No categories found for archive period');
    }

    if (!dryRun) {
        await archiveOrganizationPeriod.save();
    }
    // #endregion

    const result: Group[] = [...groups, ...[...groupMap.values()].flat()];
    return result;
}

async function migrateRegistrations({ organization, period, originalGroup, newGroup, cycle }: { organization: Organization; period: RegistrationPeriod; originalGroup: Group; newGroup: Group; cycle: number }, dryRun: boolean) {
    // what for waiting lists of archive groups (previous cycles)?
    let waitingList: Group | null = null;

    const getOrCreateWaitingList = async () => {
        if (newGroup.waitingListId) {
            if (waitingList !== null) {
                return waitingList;
            }
            const fetchedWaitingList = await Group.getByID(newGroup.waitingListId);

            if (!fetchedWaitingList) {
                throw new Error(`Waiting list not found: (waitingListId: ${newGroup.waitingListId}, groupId: ${newGroup.id})`);
            }
        }

        const newWaitingList = new Group();
        newWaitingList.cycle = cycleIfMigrated;
        newWaitingList.type = GroupType.WaitingList;
        newWaitingList.organizationId = organization.id;
        newWaitingList.periodId = period.id;
        newWaitingList.settings = GroupSettings.create({
            name: TranslatedString.create($t(`c1f1d9d0-3fa1-4633-8e14-8c4fc98b4f0f`) + ' ' + newGroup.settings.name.toString()),
        });

        if (!dryRun) {
            await newWaitingList.save();
        }

        waitingList = newWaitingList;
        return newWaitingList;
    };

    const registrations = await Registration.select()
        .where('groupId', originalGroup.id)
        .andWhere('cycle', cycle)
        .fetch();

    for (const registration of registrations) {
        if (registration.waitingList) {
            const waitingList = await getOrCreateWaitingList();
            if (newGroup.waitingListId !== waitingList.id) {
                newGroup.waitingListId = waitingList.id;

                if (!dryRun) {
                    await newGroup.save();
                }
            }

            registration.groupId = waitingList.id;
        }
        else {
            registration.groupId = newGroup.id;
        }

        registration.periodId = period.id;
        registration.cycle = cycle;

        if (!dryRun) {
            await registration.save();
        }
    }
}

// #region period spans
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

const defaultYear = 2025;
const defaultPeriodSpan = periodSpans.find(periodSpan => periodSpan.span === 12 && periodSpan.startMonth === 8)!;

function findBestPeriodMatch(cyclePeriod: { startDate: Date; endDate: Date }): { year: number; periodSpan: PeriodSpan } {
    // best match = most days overlap and least days missing
    const startYear = cyclePeriod.startDate.getFullYear();
    const endYear = cyclePeriod.endDate.getFullYear();

    const yearsToLoop = new Set([startYear - 1, startYear, endYear, endYear + 1]);
    const cycleInfo = {
        startDate: cyclePeriod.startDate,
        endDate: cyclePeriod.endDate,
    };

    let bestMatch: {
        year: number;
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
                        year,
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
                        year,
                        periodSpan,
                        daysMissing,
                        daysOverlapping,
                    };
                    continue;
                }

                if (daysOverlapping === bestMatch.daysOverlapping && daysMissing < bestMatch.daysMissing) {
                    bestMatch = {
                        year,
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
        return { year: bestMatch.year, periodSpan: bestMatch.periodSpan };
    }

    // todo?
    return { year: defaultYear, periodSpan: periodSpans[0] };
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
// #endregion

async function calculateBestCurrentPeriodSpan(groups: Group[]): Promise<{ startDate: Date; endDate: Date }> {
    // #region separate short and long groups
    const shortGroups: Group[] = [];
    const longGroups: Group[] = [];

    for (const group of groups) {
        const { startDate, endDate } = group.settings as { startDate: Date; endDate: Date };
        if (startDate && endDate && differenceInDays(startDate, endDate) < 150) {
            shortGroups.push(group);
        }
        else {
            longGroups.push(group);
        }
    }
    // #endregion

    // #region search the best period span
    const periodSpanCounts = new Map<PeriodSpan, { year: number; group: Group }[]>();
    let topPeriodSpan: PeriodSpan = defaultPeriodSpan;
    let topCount: number = 0;

    /**
     * Use the long groups to calculate the best period span.
     * If there are no long groups, use the short groups.
     * If there are no short groups, use the default period span.
     */
    for (const group of (longGroups.length ? longGroups : shortGroups)) {
        const { startDate, endDate } = group.settings as { startDate: Date; endDate: Date };

        // month start, month end, span
        const { periodSpan: bestPeriod, year } = findBestPeriodMatch({
            startDate,
            endDate });

        const groups = periodSpanCounts.get(bestPeriod) ?? [];
        // also keep track of the year to find the best year later
        groups.push({ group, year });

        if (groups.length > topCount) {
            topCount = groups.length;
            topPeriodSpan = bestPeriod;
        }
        periodSpanCounts.set(bestPeriod, groups);
    }
    // #endregion

    // #region find the best year
    let topYear = defaultYear;
    const groupsInTopPeriodSpan = periodSpanCounts.get(topPeriodSpan) ?? [];

    // calculate the number of groups in each year
    const yearMap = new Map<number, Group[]>();
    for (const { group, year } of groupsInTopPeriodSpan) {
        const groups = yearMap.get(year) ?? [];
        groups.push(group);
        yearMap.set(year, groups);
    }

    // get the year with the most groups
    let topYearCount = 0;
    for (const [year, groups] of yearMap.entries()) {
        if (groups.length > topYearCount) {
            topYearCount = groups.length;
            topYear = year;
        }
    }
    // #endregion

    const startDate = new Date(topYear, topPeriodSpan.startMonth, 1);
    const endDate = new Date((new Date(topYear, topPeriodSpan.startMonth + topPeriodSpan.span)).getTime() - 1);

    return { startDate, endDate };
}

// #region helpers
function differenceInDays(date1: Date, date2: Date) {
    const diffTime = Math.abs(date2.getTime() - date1.getTime());
    return timeToDays(diffTime);
}

function timeToDays(time: number): number {
    return Math.ceil(time / (1000 * 60 * 60 * 24));
}

// #endregion

// #region factories
async function createDefaultRegistrationPeriod(organization: Organization, dryRun: boolean) {
    // first check if already has a registration period for the organization
    const registrationPeriod = await RegistrationPeriod.getByID(organization.periodId); ;
    if (registrationPeriod && registrationPeriod.organizationId === organization.id) {
        return;
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

function createPreviousGroup({ originalGroup, period, cycleInformation, index }: { originalGroup: Group; period: RegistrationPeriod; cycleInformation: CycleInformation; index: number }) {
    const newGroup = new Group();
    newGroup.organizationId = originalGroup.organizationId;
    newGroup.periodId = period.id;
    newGroup.status = originalGroup.status;
    newGroup.createdAt = originalGroup.createdAt;
    newGroup.deletedAt = originalGroup.deletedAt;

    const originalPrivateSettings: GroupPrivateSettings = originalGroup.privateSettings;

    // todo: should group ids in permissions get updated?
    newGroup.privateSettings = GroupPrivateSettings.create({
        ...originalPrivateSettings,
    });

    newGroup.cycle = cycleIfMigrated;

    const originalSettings: GroupSettings = originalGroup.settings;

    const periodStartDate: Date = period.startDate;
    const periodEndDate: Date = period.endDate;

    // todo: how to choose start and end dates?
    let startDate = new Date(periodStartDate);
    let endDate = new Date(periodEndDate);

    if (cycleInformation.startDate && cycleInformation.endDate) {
        startDate = new Date(cycleInformation.startDate);
        endDate = new Date(cycleInformation.endDate);
    }

    const isPlural = index > 0;
    const extraName = isPlural ? `${index + 1} periodes geleden` : `${index + 1} periode geleden`;

    newGroup.settings = GroupSettings
        .create({
            ...originalSettings,
            cycleSettings: new Map(),
            name: new TranslatedString(`${originalSettings.name.toString()} (${extraName})`),
            startDate,
            endDate,
        });
    newGroup.type = originalGroup.type;

    return newGroup;
}
// #endregion
