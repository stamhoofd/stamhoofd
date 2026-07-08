import { Migration } from '@simonbackx/simple-database';
import { Group, Organization, OrganizationRegistrationPeriod, Registration, RegistrationPeriod, V1GroupMigrationData } from '@stamhoofd/models';
import { GroupCategory, GroupCategorySettings, GroupPrivateSettings, GroupSettings, GroupStatus, TranslatedString } from '@stamhoofd/structures';
import { SeedTools } from '../helpers/SeedTools.js';

export default new Migration(async () => {
    if (STAMHOOFD.environment === 'test') {
        console.log('skipped in tests');
        return;
    }

    if (STAMHOOFD.platformName.toLowerCase() !== 'stamhoofd') {
        console.log('skipped for platform (only runs for Stamhoofd): ' + STAMHOOFD.platformName);
        return;
    }

    const dryRun = false;
    await start(dryRun);

    if (dryRun) {
        throw new Error('Migration did not finish because of dryRun');
    }
});

// organizations with registration where periodId is the id of the platform period
const relevantOrganizations = new Set([
    '453bd0b1-f238-4a41-a270-99bb13c71f46', 'c69512bc-ea0c-427a-ab90-08c3dcf1c856', '2cec1ef3-80bc-43ad-929e-4a9ddb6d6d8d', 'ede34921-efd4-446b-93c5-aa9c38b05f8a', '235b03ae-6513-4fe6-a438-217887826a26', '8df666ab-c645-47f7-a171-c305ab556ecb', '971e1bac-2668-4d7a-870c-8007c47f878f', 'e04bcda4-b8d3-4897-b1fb-e565368167fa', 'd017c264-8ad2-42e7-b46a-4ba6bb3d4ca6', 'f0edb665-1ce0-442a-88e7-5a62ea78c5fc', '45fcc4f2-c406-45fc-aaaf-9bdc06d9e68d', 'ed6e74f1-51a0-4e04-8195-e722b015eeb5', '45743bb7-539e-41a3-885d-c8cc57e73ac6', '9a635b47-2189-4fb5-983c-15a1cdf05ffd', 'a2b6a2de-5021-4533-88db-f64c8c07d89d', '97928f8a-b8d1-44cc-918f-09d0ae896c3b', '57815733-5750-492f-beb1-1efd6229803a', '0a78224a-2ec4-42d7-a5e5-e29b2732c6d7', '28f1a27e-1edd-4169-b98f-3ae0f8bb806f', 'eb6ccffa-41c5-45df-b4e4-1eb5749bc0fe', '27e06924-49a6-468c-a16e-b5735ace1894', '684c20b1-de07-40a4-8a92-5a7d30f32132', '3806a968-c55c-46e5-a674-95dd7b7f6f3f', 'd4b73261-a2d8-4f85-854e-38373012b22d',
]);

// groups with registration where periodId is the id of the platform period
const relevantGroups = new Set([
    'e6b18bcc-181a-4d7c-97c4-89ac2a846b80', '402ad45d-3cf1-49cb-88f0-3000df02fbe0', 'a768538a-942d-4adb-819a-f2915aabb205', '651c8b41-9760-43f1-ab7a-177c860dde28', '0ca82d1c-75fb-4096-91be-c9331e9e86e4', '5bf1c5e9-1557-4d33-a4b8-5040ec115ad3', '476c3373-81c1-47d2-a2ad-7f0e545a6207', 'e86b908b-3a9a-4974-b839-5c3e83ec1590', 'ceecef6a-e537-4954-96e5-c6c9904bec74', '60008a98-0cb2-45a2-8346-80ab7a6155dd', '0fd87a5d-2234-4b94-9d54-a663ba8c6a11', '83ab5758-d9a9-4675-9667-7735c6097446', '0e50b08a-93c7-4917-985e-5725687bcc26', '3dea4b34-4183-4e82-aa33-0ba8b61737f0', '1bf7ab25-bd12-4315-afc3-49be1878ad02', '6c04eb42-e9f6-4931-a862-e671be5f7495', 'a43054fb-9efb-46ac-b49b-e86fca343c10', 'c2757b10-3012-483b-abf0-c639ed55bb7c', 'adb253da-2696-45bd-9743-889eb52e953c', '387d06fc-771a-4b4b-b69a-f72827a49a51', '29b955ec-5987-4e25-8d20-1f6cfbfdd198', 'c85cff0f-3798-4d32-8067-8026ada0bb9c', 'e0b4a178-a682-4eb2-b720-bf82c80bfb34', 'c75af993-c9ae-41b5-83f3-5c30bf61c74e', 'd910d04c-90e2-4079-a997-316141f4739d', '3b81c7d9-5a4a-4323-a152-0219755f164f', '7b1767d5-fef5-4520-8748-5c2e3e1e97e5', 'f322530a-03ab-4b4a-b5c4-1a98608b12ee', '3c9b619d-c210-4fc9-950b-3a808e942ad1', '6548de8b-3b02-469f-87f5-a9e661f29ba0', '03e9c564-da0f-4a08-b843-13d830b3e061', 'f9e398df-4d26-4efb-af79-310aecde6678', '7f9310af-a48b-46c5-8a7f-d125d66ee9cf', '09c264e9-f327-4ccf-bf12-dd412cd23c1b', '765517b2-65df-446a-b9ad-7a7281f91af6', '9cea7eb7-6aac-4627-b6bb-7a117e99652c', '525f0600-aff5-47c7-9df4-6a18b0cfec2f', 'c9374388-e187-4dae-9f48-bee17fff4975', '60ff9fc5-b32f-4ee5-9532-54fcecbf00ba', 'bdbe1e9c-c25a-48f2-b506-d554d58cb02a', '47988375-8aef-45e9-8a5c-9a21a51f5c6b', '99dfd728-991f-408f-9b77-ad9f736600ab', 'a8d4845a-ecdb-4f2f-b66d-a6955e30c3db', '55d32f3b-6396-488e-98c2-1f1e9d37a7d6', '27842912-673a-42a6-9c2a-2285da36c5b4', '1667c735-bb37-4402-beda-aed88066abe3', '60943cd6-1498-456f-b540-413d7125c88f', '39a21999-4923-48ec-9118-5b98232543e5', '4952282e-dc63-4c79-b63b-ddbe3f9006fa', '887827d1-db4d-40ac-8bf4-6fc64910f13a', 'c9e4a223-cd65-4545-a322-400d84ece455', '5d0916ea-8f13-4f15-bf98-0358e527890d', '77d4eb10-e3b8-4e8e-bb06-272d085ff516', '790ae8d1-e98d-4bb2-b2cc-a77a21e8c712', '1599bb4e-9723-4a90-a36a-4605644983be', '6bb1dcad-ee5e-44e6-ab09-6ae381871566', 'd201de16-7bc7-4f98-a22b-5c335b2c872f', '090b0c1d-1481-4535-9034-219dbe4eb35c', 'b2831403-d272-46f4-9f2a-6084165c482e', 'ade7eda4-72c6-48e4-ac66-4b7c9a68f5cb', '09c3ac0f-ee98-4c11-a7fb-4601daf15ea1', '6d89b200-cf8d-4d4b-9cd7-ed65d3cd8c57', '820b1a0e-2c80-4402-94ad-c0e873d127f9', '094db6ad-40d9-4b0d-9670-74b6de99c0ca', '21b42f15-de4e-4c16-8ea0-ea83fbc3ba44', '2d2a3ab8-7bd9-4877-9122-23dc2435b73f', '7974762f-b0f3-4010-8b08-5ce1e45a14a8', '374c994e-85b9-4d22-92f4-3a094ae5fc5f', 'b81547bf-1a5f-4443-8a41-1f0e8f9e5ff4', 'a45fddb7-5dae-4330-907f-584f788bde14', '4828698d-6a8a-4937-bfe8-ca4b55d9d5a7', '2b3a9502-1943-4c00-baf2-24b8dcd191f2', '7b402e0d-219d-430e-9ebf-d2471bbb6629', 'd2626510-32f1-4677-8bbe-f3b31b529221', 'f4038ea4-cf03-4677-babc-d525f73d7378', '7e225069-3e49-486a-8187-f26947567bc6', '8d1f6366-8f28-47b9-b616-9afcc4575fc4', '17bd4f4a-203d-430d-a4b0-03aa8f9b9015', '968619a9-1483-4beb-931d-4f819cef674a', '68f958e1-491d-4f26-ad61-1598500202d8', '6848ce16-e637-4f4b-8a25-75f958654ee2', '9419df04-4181-4780-abc5-dcfc0d705c12', '9fa735ba-00de-4eac-b659-73966415f60f', '6ec3ea7e-0cbf-4b4a-9177-98c8bffd6cfe', 'c36b43c9-25c9-4820-a2e8-de256b165a33', '56589baa-e4a1-4ba0-921b-ae9f621cbf04', '8ab04173-37c9-48df-a8f1-f1ebbe7fd230', 'bb06cec4-a028-4e91-b177-53aa596baffc', '139c1164-672c-4d33-8bc9-c29893793adf', 'ecf914c4-84c8-4ac8-80df-e15283bbd270', 'bf16f791-4c05-418c-a6b2-129f43bf2567', '912c1022-065d-4bbd-a750-ba5356016ae3', '494882e1-8933-4e39-9523-180d250668dd',
]);

async function start(dryRun: boolean) {
    await SeedTools.loop({
        query: Organization.select().where('id', Array.from(relevantOrganizations)),
        batchSize: 1,
        useTransactionPerBatch: true,
        action: async (organization: Organization) => {
            if (!relevantOrganizations.has(organization.id)) {
                return;
            }

            const groups: Group[] = await Group.select()
                .where('organizationId', organization.id)
                .where('id', Array.from(relevantGroups))
                .fetch();

            for (const group of groups) {
                if (!relevantGroups.has(group.id)) {
                    continue;
                }

                await fixRegistrations(organization, group, dryRun);
            }
        },

    });
}

async function getOriginalGroupCycle(group: Group): Promise<number> {
    const migrationData = await V1GroupMigrationData.select().where('oldGroupId', group.id).andWhere('newGroupId', group.id).first(true);
    return migrationData.oldCycle;
}
async function getNewGroupForCycle(oldGroupId: string, cycle: number) {
    const migrationData = await V1GroupMigrationData.select().where('oldGroupId', oldGroupId).andWhere('oldCycle', cycle).first(false);
    if (!migrationData) {
        return null;
    }

    const newGroupId = migrationData.newGroupId;
    const group = await Group.getByID(newGroupId);
    if (!group) {
        throw new Error('group not found');
    }
    return group;
}

async function fixRegistrations(organization: Organization, group: Group, dryRun: boolean) {
    const originalGroupCycle = await getOriginalGroupCycle(group);

    const registrations = await Registration.select()
        .where('groupId', group.id)
        // where cycle is different from group
        .whereNot('cycle', originalGroupCycle)
        .fetch();

    const cycleMap = new Map<number, Registration[]>();

    // group registrations by cycle
    for (const registration of registrations) {
        let registrations = cycleMap.get(registration.cycle);
        if (!registrations) {
            registrations = [];
            cycleMap.set(registration.cycle, registrations);
        }

        registrations.push(registration);
    }

    const archivePeriod = await RegistrationPeriod.select().where('organizationId', group.organizationId).where('customName', 'Gearchiveerde periodes').first(true);

    const createdGroups: Group[] = [];

    for (const [cycle, registrations] of cycleMap) {
        // find new group
        const newGroup = await getNewGroupForCycle(group.id, cycle);

        if (newGroup) {
            await migrateRegistrations({ registrations, newGroup, cycle }, dryRun);
        } else {
            console.log(`missing group for ${group.settings.name.toString()} cycle ${cycle}`);

            const numberOfPeriodsAgo = originalGroupCycle - cycle;
            const newGroup = createPreviousGroup({ originalGroup: group, period: archivePeriod, numberOfPeriodsAgo });

            if (!dryRun) {
                const migrationData = new V1GroupMigrationData();
                migrationData.oldGroupId = group.id;
                migrationData.oldCycle = cycle;

                await newGroup.save();
                migrationData.newGroupId = newGroup.id;
                await migrationData.save();
            }

            createdGroups.push(newGroup);

            await migrateRegistrations({ registrations, newGroup, cycle }, dryRun);
        }
    }

    if (createdGroups.length > 0) {
        const archiveOrganizationPeriod = await OrganizationRegistrationPeriod.select().where('organizationId', organization.id).where('periodId', archivePeriod.id).first(true);
        const parentCategory = await findCategory(group, archiveOrganizationPeriod);

        if (parentCategory) {
            for (const newGroup of createdGroups) {
                if (newGroup.id === undefined && dryRun) {
                    continue;
                }

                if (!parentCategory.groupIds.includes(newGroup.id)) {
                    parentCategory.groupIds.push(newGroup.id);
                } else {
                    throw new Error('group already in category:' + newGroup.id);
                }

                await cleanupGroup(newGroup, dryRun);
            }
        } else {
            const { path, organizationPeriod: currentOrganizationPeriod } = await findPath(group);
            const allArchivedCategories = archiveOrganizationPeriod.settings.categories;

            const archivedRoot = archiveOrganizationPeriod.settings.rootCategory;
            if (!archivedRoot) {
                throw new Error('archived root category not found');
            }
            let thisLayer = getChildCategories(archivedRoot, allArchivedCategories);
            const equalArchivedPath: GroupCategory[] = [archiveOrganizationPeriod.settings.rootCategory!];

            for (const currentPeriodCategory of path) {
                if (currentPeriodCategory === currentOrganizationPeriod.settings.rootCategory) {
                    continue;
                }

                // only exact match for last category is needed
                const exactMatch = currentPeriodCategory !== path[path.length - 1];
                let equalArchivedCategories = thisLayer.filter(archivedCategory => isEqualCategory(currentPeriodCategory, archivedCategory, exactMatch));

                if (equalArchivedCategories.length > 1) {
                    const exactMatches = equalArchivedCategories.filter(archivedCategory => isEqualCategory(currentPeriodCategory, archivedCategory, true));

                    if (exactMatches.length === 0) {
                        throw new Error(`Found multiple equal categories but no exact match (${currentPeriodCategory.settings.name}): ` + equalArchivedCategories.map(c => c.settings.name).join(', '));
                    }

                    if (exactMatches.length > 1) {
                        equalArchivedCategories = [await getCategoryWhereGroupHasSameOriginalGroup(exactMatches, group)];
                    } else {
                        equalArchivedCategories = exactMatches;
                    }
                }

                if (equalArchivedCategories.length === 0) {
                    break;
                }

                const equalArchivedCategory = equalArchivedCategories[0];
                thisLayer = getChildCategories(equalArchivedCategory, allArchivedCategories);
                equalArchivedPath.push(equalArchivedCategory);
            }

            // logging
            console.log('organization: ', organization.name);
            console.log('group: ', group.settings.name.toString());
            logPath(path, 'current');
            logPath(equalArchivedPath, 'archived');

            if (path.length === equalArchivedPath.length) {
                // complete match -> add group to last category
                const lastCategory = equalArchivedPath[equalArchivedPath.length - 1];

                if (lastCategory.groupIds.length) {
                    // add created groups to last category
                    for (const createdGroup of createdGroups) {
                        if (!lastCategory.groupIds.includes(createdGroup.id)) {
                            lastCategory.groupIds.push(createdGroup.id);
                        }
                    }
                } else {
                    // create new category
                    const newCategory = createCategoryForOriginalGroup(group, createdGroups.map(g => g.id));
                    lastCategory.categoryIds.push(newCategory.id);
                    archiveOrganizationPeriod.settings.categories.push(newCategory);
                }
            } else {
                // should not happen
                throw new Error('no complete match');
            }
        }

        if (!dryRun) {
            await archiveOrganizationPeriod.save();
        }
    }

    if (!dryRun) {
        await group.updateOccupancy();
        await group.save();
    }
}

async function getCategoryWhereGroupHasSameOriginalGroup(exactMatches: GroupCategory[], originalGroup: Group) {
    for (const category of exactMatches) {
        const migrationData = await V1GroupMigrationData.select().where('newGroupId', category.groupIds).andWhere('oldGroupId', originalGroup.id).first(false);
        if (migrationData) {
            return category;
        }
    }

    throw new Error('no category found');
}

function createCategoryForOriginalGroup(originalGroup: Group, groupIds: string[]) {
    return GroupCategory.create({
        settings: GroupCategorySettings.create({
            name: originalGroup.settings.name.toString(),
            public: false,
            maximumRegistrations: null,
        }),
        groupIds,
    });
}

function getChildCategories(category: GroupCategory, allCategories: GroupCategory[]) {
    const results: GroupCategory[] = [];

    for (const childId of category.categoryIds) {
        const child = allCategories.find(c => c.id === childId);
        if (!child) {
            throw new Error('child category not found');
        }
        results.push(child);
    }

    return results;
}

function logPath(path: GroupCategory[], prefix: string): void {
    console.log(`${prefix} path: ${path.map(c => c.settings.name).join(' > ')}`);
}

function isEqualCategory(currentPeriodCategory: GroupCategory, archivedPeriodCategory: GroupCategory, exactMatch: boolean) {
    if (exactMatch) {
        return archivedPeriodCategory.settings.name === currentPeriodCategory.settings.name;
    }
    return archivedPeriodCategory.settings.name.startsWith(currentPeriodCategory.settings.name);
}

/**
 * Find the path from the old group to the root category.
 */
async function findPath(oldGroup: Group): Promise<{ path: GroupCategory[]; organizationPeriod: OrganizationRegistrationPeriod }> {
    /**
     * Returns all the parent categories of the group starting with the root category (= start) or null if not found.
     */
    function getPathToGroup(groupId: string, start: GroupCategory, allCategories: GroupCategory[]): GroupCategory[] | null {
        if (start.groupIds.includes(groupId)) {
            return [start];
        }

        for (const childCategoryId of start.categoryIds) {
            const childCategory = allCategories.find(c => c.id === childCategoryId);
            if (childCategory) {
                const childPath = getPathToGroup(groupId, childCategory, allCategories);
                if (childPath !== null) {
                    return [start, ...childPath];
                }
            }
        }

        return null;
    }

    const organizationPeriod = await OrganizationRegistrationPeriod.select()
        .where('organizationId', oldGroup.organizationId)
        .where('periodId', oldGroup.periodId)
        .first(true);

    const root = organizationPeriod.settings.rootCategory;
    if (!root) {
        throw new Error('root category not found');
    }

    const path = getPathToGroup(oldGroup.id, root, organizationPeriod.settings.categories);
    if (path === null) {
        throw new Error('path not found');
    }

    return {
        organizationPeriod,
        path,
    };
}

async function cleanupGroup(group: Group, dryRun: boolean) {
    group.settings.cycleSettings = new Map();
    group.settings.preventPreviousGroupIds = [];
    group.settings.requirePreviousGroupIds = [];
    group.cycle = cycleIfMigrated;
    if (group.status === GroupStatus.Archived) {
        group.status = GroupStatus.Closed;
    }

    if (!dryRun) {
        await group.updateOccupancy();
        await group.save();
    }
}

async function migrateRegistrations({ registrations, newGroup, cycle }: { registrations: Registration[]; newGroup: Group; cycle: number }, dryRun: boolean) {
    for (const registration of registrations) {
        if (registration.waitingList) {
            throw new Error('not supported');
        } else {
            registration.groupId = newGroup.id;
        }

        registration.periodId = newGroup.periodId;
        registration.cycle = cycle;

        if (!dryRun) {
            await registration.save();
        }
    }
}

async function findCategory(group: Group, archiveOrganizationPeriod: OrganizationRegistrationPeriod) {
    const previousGroups = await V1GroupMigrationData.select().where('oldGroupId', group.id).andWhereNot('newGroupId', group.id).fetch();

    for (const previousGroup of previousGroups) {
        const previousGroupId = previousGroup.newGroupId;
        if (previousGroup.oldGroupId !== group.id || previousGroup.newGroupId === group.id) {
            throw new Error('group id mismatch');
        }

        const allCategories = archiveOrganizationPeriod.settings.categories;
        const rootCategory = archiveOrganizationPeriod.settings.rootCategory;
        if (!rootCategory) {
            throw new Error('root category not found for archiveOrganizationPeriod: ' + archiveOrganizationPeriod.id);
        }

        const parentCategory = allCategories.find(c => c.groupIds.includes(previousGroupId));
        if (parentCategory) {
            return parentCategory;
        }
    }

    return null;
}

const cycleIfMigrated = -99;

function createPreviousGroup({ originalGroup, period, numberOfPeriodsAgo }: { originalGroup: Group; period: RegistrationPeriod; numberOfPeriodsAgo: number }) {
    const newGroup = new Group();
    newGroup.organizationId = originalGroup.organizationId;
    newGroup.periodId = period.id;
    newGroup.status = originalGroup.status;
    newGroup.createdAt = originalGroup.createdAt;
    newGroup.deletedAt = originalGroup.deletedAt;

    const originalPrivateSettings: GroupPrivateSettings = originalGroup.privateSettings;

    newGroup.privateSettings = GroupPrivateSettings.create({
        ...originalPrivateSettings,
    });

    newGroup.cycle = cycleIfMigrated;

    const originalSettings: GroupSettings = originalGroup.settings;

    const periodStartDate: Date = period.startDate;
    const periodEndDate: Date = period.endDate;

    const startDate = new Date(periodStartDate);
    const endDate = new Date(periodEndDate);

    const isPlural = numberOfPeriodsAgo > 1;
    const extraName = isPlural ? `${numberOfPeriodsAgo} periodes geleden` : `${numberOfPeriodsAgo} periode geleden`;

    newGroup.settings = GroupSettings
        .create({
            ...originalSettings,
            cycleSettings: new Map(),
            name: new TranslatedString(`${originalSettings.name.toString()} (${extraName})`),
            startDate,
            endDate,
            hasCustomDates: true,
            period: period.getBaseStructure(),
        });
    newGroup.type = originalGroup.type;

    return newGroup;
}
