import { Migration } from '@simonbackx/simple-database';
import { Group, Organization, OrganizationRegistrationPeriod, Registration, RegistrationInvitation, RegistrationPeriod, V1GroupMigrationData, V1WaitingListMigrationData } from '@stamhoofd/models';
import { GroupCategory, GroupCategorySettings, GroupPrivateSettings, GroupSettings, GroupStatus, GroupType, TranslatedString } from '@stamhoofd/structures';
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

    const dryRun = true;
    await start(dryRun);

    if (dryRun) {
        throw new Error('Migration did not finish because of dryRun');
    }
});

async function start(dryRun: boolean) {
    const relevantOrganizations = new Set(['10827cc5-5f29-46cf-b26e-5fd11a9342cc', '16742d64-0b31-4ce7-9c1e-6194882045b9', '27e06924-49a6-468c-a16e-b5735ace1894', '33744473-9ad9-4d3e-a9fc-31cd1b6a2753', '3e6f5cb9-e130-4dda-92c9-26682fa09509', '45743bb7-539e-41a3-885d-c8cc57e73ac6', '57815733-5750-492f-beb1-1efd6229803a', '5f4d4a26-43c3-4f80-86ad-64d07d5a46a7', '74e2bcbf-0ff9-484b-988a-e11d147122c0', '7677e32d-763a-4033-bc74-30d13f27556d', '7ac75a0f-f365-4ddc-836c-66a3267f24f0', '8df666ab-c645-47f7-a171-c305ab556ecb', '95d59803-c50e-4bc1-adc9-90ade32b7579', '971e1bac-2668-4d7a-870c-8007c47f878f', '97928f8a-b8d1-44cc-918f-09d0ae896c3b', 'e04bcda4-b8d3-4897-b1fb-e565368167fa', 'e2afe517-cd35-4d9e-a561-125ad184a2ff', 'eb6ccffa-41c5-45df-b4e4-1eb5749bc0fe', 'ed6e74f1-51a0-4e04-8195-e722b015eeb5', 'ede34921-efd4-446b-93c5-aa9c38b05f8a', 'f0edb665-1ce0-442a-88e7-5a62ea78c5fc', 'f2543d6b-523e-4b03-848b-838200b1ff41', 'f562c735-7bf4-4e2e-8c0f-6584e8e96a1d', 'fd934e40-734c-442d-b338-c3ae288dd55d']);

    const relevantGroups = new Set([
        '3d68762b-8133-42e0-a642-7649864b09b3', '8f98e452-e174-4946-96ec-888cc3498f56', '88d87c1a-749f-453c-a60b-e54a7001a9f0', '56589baa-e4a1-4ba0-921b-ae9f621cbf04', '2e473bf7-36f9-4276-8770-032db776d154', '8983c1d5-e8aa-4628-a251-17220336fad5', '12ba896a-e064-4697-a5df-69664c9bd8cb', '7989ea9d-354d-4eff-9350-8eb8a6c4732b', '8fdffd17-84fa-41f7-8b74-744578d4b9d9', '92ae627b-8aa4-4197-885e-603d4a1be8aa', 'a690c59b-72eb-40bb-b181-d9dc904f9ec1', 'a9b0a795-3b7e-40bb-b8ec-65280d149dba', 'c806a74d-f0ae-4473-86bd-facb92085eb1', 'eda36826-ee68-414d-a773-cb41e1a1e2d6', 'f822b26a-715a-4154-b2a2-b11e38373fad', '09c3ac0f-ee98-4c11-a7fb-4601daf15ea1', '2b3a9502-1943-4c00-baf2-24b8dcd191f2', '4828698d-6a8a-4937-bfe8-ca4b55d9d5a7', '55d32f3b-6396-488e-98c2-1f1e9d37a7d6', '7e225069-3e49-486a-8187-f26947567bc6', '912c1022-065d-4bbd-a750-ba5356016ae3', '9419df04-4181-4780-abc5-dcfc0d705c12', '9fa735ba-00de-4eac-b659-73966415f60f', '134e33f9-3560-4eca-977b-aaef01af5ed4', '76aef892-19b5-4deb-9276-0c6b19b652fd', '82958c24-bc12-45f2-9d0d-3c8b902df052', 'd715451c-6292-4d58-83f8-ffce115fca21', '6535d9b4-f2ad-4f7e-b7e2-9e50ddf5eff6', '6a508234-08aa-4b0b-9647-7aeb9d80fa5a', 'dfaf11b8-f835-4952-99e1-2b0279931b05', '1a9bb59a-c85a-4338-94c6-f82061f1ee0e', '1bf5519d-4645-4c51-8ae5-7a202bb74e9e', '5870423f-6faf-492e-accb-4bd110365328', '78fa525b-e346-4b78-9e25-f9b1b5134b77', '88c28670-cf97-42e2-ae9e-d836d349c2e6', 'ab9ddbb9-21bc-4a8e-be7f-036554b70db4', 'd0cf99ce-24e9-4912-9dc8-660b4ff57dcc', 'ceecef6a-e537-4954-96e5-c6c9904bec74', '89ced76d-8c98-4f83-bffa-8b467289972d', 'bea51786-4d47-4bcb-bf79-fc636f047cbb', '1599bb4e-9723-4a90-a36a-4605644983be', '4952282e-dc63-4c79-b63b-ddbe3f9006fa', '60943cd6-1498-456f-b540-413d7125c88f', '83ab5758-d9a9-4675-9667-7735c6097446', 'ade7eda4-72c6-48e4-ac66-4b7c9a68f5cb', 'bdbe1e9c-c25a-48f2-b506-d554d58cb02a', 'e0b4a178-a682-4eb2-b720-bf82c80bfb34', 'f9e398df-4d26-4efb-af79-310aecde6678', '1ddc6fde-f512-43ac-8e15-2496601e900e', '52b0285c-4935-4577-bc7b-30d0b8804fc9', '0e50b08a-93c7-4917-985e-5725687bcc26', '6848ce16-e637-4f4b-8a25-75f958654ee2', '6bb1dcad-ee5e-44e6-ab09-6ae381871566', '7b1767d5-fef5-4520-8748-5c2e3e1e97e5', '9cea7eb7-6aac-4627-b6bb-7a117e99652c', 'fe2e4ec5-cee4-4648-ae87-2f8dee7f42c8', '9852662c-7e9f-4c26-a6d3-6335b49b9b3b', 'd76b57b8-10c4-43e4-94d1-bb66d1053bb4', 'e9fe89f8-780b-417f-a4ee-b48e0b0bb8ad', 'f7e5436c-855d-4bf9-b2de-94e9d0fd3052', '3490cfd8-4c0b-487f-8f0d-c96c62950160', '21b42f15-de4e-4c16-8ea0-ea83fbc3ba44', '5bf1c5e9-1557-4d33-a4b8-5040ec115ad3', '03e9c564-da0f-4a08-b843-13d830b3e061', '20cab6ae-fb30-4de8-948e-60caf0979ff7', '29b955ec-5987-4e25-8d20-1f6cfbfdd198', 'a45fddb7-5dae-4330-907f-584f788bde14', 'c2757b10-3012-483b-abf0-c639ed55bb7c', 'c9064135-322e-4848-9de0-61011d067697', 'cb7e738f-bcb5-4bc5-9962-2608ea9c4094', 'dcffb511-131b-401c-a4b5-13810596bc42', '020a313c-0e97-4068-84ba-783d91e768a4', '8113c2a2-e788-4f11-815f-4b019d7ca966', '8bb9b1c6-2d40-4a69-bbd5-63ce152b1a91', 'a25bbeae-86b9-4162-8570-d121845f26e9', 'f163d78a-9539-43a3-aeb7-443559599342', 'f24e2ca9-3036-4839-9ff4-91bd4ecb5c91', 'ff3a7e68-feb7-4aca-983d-a8f8315851e7',
    ]);

    let total = 0;

    await SeedTools.loop({
        query: Organization.select(),
        batchSize: 50,
        useTransactionPerBatch: true,
        action: async (organization: Organization) => {
            if (!relevantOrganizations.has(organization.id)) {
                return;
            }

            const groups: Group[] = await Group.select()
                .where('organizationId', organization.id)
                .fetch();

            for (const group of groups) {
                if (!relevantGroups.has(group.id)) {
                    continue;
                }

                await fixRegistrations(organization, group, dryRun);
                console.log('Fixed registrations for group: ' + group.id);
                total += 1;
            }
        },

    });

    console.log('Fixed ' + total + ' registrations');
}

async function fixRegistrations(organization: Organization, group: Group, dryRun: boolean) {
    const registrations = await Registration.select()
        .where('groupId', group.id)
        .fetch();

    const cycles = new Set<number>();

    for (const registration of registrations) {
        cycles.add(registration.cycle);
    }

    if (cycles.size < 2) {
        console.error('No multiple cycles found for group (not expected):', group.id);
        return;
    }

    const sortedCycles = Array.from(cycles).sort((a, b) => b - a);

    const cyclesToMigrate = sortedCycles.slice(1);

    const archivePeriod = await RegistrationPeriod.select().where('organizationId', group.organizationId).where('customName', 'Gearchiveerde periodes').first(true);
    const archiveOrganizationPeriod = await OrganizationRegistrationPeriod.select().where('organizationId', organization.id).where('periodId', archivePeriod.id).first(true);

    const startIndex = await getStartIndex(group);
    let currentIndex: number = startIndex;

    const allNewGroups: Group[] = [];

    for (const cycle of cyclesToMigrate) {
        const newGroup = createPreviousGroup({ originalGroup: group, period: archivePeriod, index: currentIndex });

        const migrationData = new V1GroupMigrationData();
        migrationData.oldGroupId = group.id;
        migrationData.oldCycle = cycle;

        currentIndex = currentIndex + 1;

        const registrationCount = await Registration.select()
            .where('groupId', group.id)
            .andWhere('cycle', cycle)
            .count();

        // only create group if there are registrations
        if (registrationCount > 0) {
            if (!dryRun) {
                await newGroup.save();
                migrationData.newGroupId = newGroup.id;
                await migrationData.save();
            }

            await migrateRegistrations({ organization, period: archivePeriod, originalGroup: group, newGroup, cycle }, dryRun);
            allNewGroups.push(newGroup);
        } else {
            console.error('No registrations found for group (not expected):', group.id);
        }

        // not needed to migrate requirePreviousGroupIds (was never set for these groups, checked in database)
        // only 2 groups where preventPreviousGroupIds was set -> fix them manually ('6a508234-08aa-4b0b-9647-7aeb9d80fa5a', 'dfaf11b8-f835-4952-99e1-2b0279931b05')
    }

    if (allNewGroups.length === 0) {
        throw new Error('No new groups for group (unexpected): ' + group.id);
    }

    console.log('start find category for group: ' + group.id);
    const parentCategory = await findCategory(group, archiveOrganizationPeriod);

    for (const newGroup of allNewGroups) {
        if (!parentCategory.groupIds.includes(newGroup.id)) {
            parentCategory.groupIds.push(newGroup.id);
        } else {
            throw new Error('group already in category:' + newGroup.id);
        }

        await cleanupGroup(newGroup, dryRun);
    }

    if (!dryRun) {
        await archiveOrganizationPeriod.save();
        await group.updateOccupancy();
        await group.save();
    }
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

async function findCategory(group: Group, archiveOrganizationPeriod: OrganizationRegistrationPeriod) {
    const previousGroup = await V1GroupMigrationData.select().where('oldGroupId', group.id).andWhereNot('newGroupId', group.id).first(false);

    if (!previousGroup) {
        // todo: create new category
        const period = await RegistrationPeriod.getByID(group.periodId, true);
        const organizationRegistrationPeriod = await OrganizationRegistrationPeriod.getByID(period.id, true);
        const allCategories = organizationRegistrationPeriod.settings.categories;
        const rootCategory = organizationRegistrationPeriod.settings.rootCategory;
        if (!rootCategory) {
            throw new Error('root category not found for current period: ' + organizationRegistrationPeriod.id);
        }
        const originalParentCategory = findCategoryOfGroup(rootCategory, group.id, allCategories);
        if (!originalParentCategory) {
            throw new Error('original parent category not found for group: ' + group.id);
        }



        const allParentCategories = originalParentCategory.getParentCategories(allCategories);

                const clonedCategory = GroupCategory.create({
            settings: GroupCategorySettings.create({
                ...originalParentCategory.settings,
            }),
        });

        for(const parentCategory of allParentCategories) {
            const archivedEquivalent = archiveOrganizationPeriod.settings.categories.find(c => c.)
        }

        return originalCategory;
    }

    const previousGroupId = previousGroup.newGroupId;
    if (previousGroup.oldGroupId !== group.id || previousGroup.newGroupId === group.id) {
        throw new Error('group id mismatch');
    }

    const allCategories = archiveOrganizationPeriod.settings.categories;
    const rootCategory = archiveOrganizationPeriod.settings.rootCategory;
    if (!rootCategory) {
        throw new Error('root category not found for archiveOrganizationPeriod: ' + archiveOrganizationPeriod.id);
    }

    const parentCategory = findCategoryOfGroup(rootCategory, previousGroupId, allCategories);
    if (!parentCategory) {
        throw new Error('parent category not found for previousGroupId: ' + previousGroupId);
    }

    return parentCategory;
}

function findCategoryOfGroup(category: GroupCategory, groupId: string, allCategories: GroupCategory[]): GroupCategory | null {
    return allCategories.find(c => c.groupIds.includes(groupId)) || null;
    const match = category.groupIds.find(id => id === groupId);
    if (match) {
        return category;
    }

    for (const child of category.categoryIds) {
        const childCategory = allCategories.find(c => c.id === child);
        if (!childCategory) {
            continue;
        }
        const category = findCategoryOfGroup(childCategory, groupId, allCategories);
        if (category) {
            return category;
        }
    }
    return null;
}

async function getStartIndex(group: Group) {
    const groupCount = await V1GroupMigrationData.select().where('oldGroupId', group.id).andWhereNot('newGroupId', group.id).count();
    const index = groupCount + 1;
    return index;
}

const cycleIfMigrated = -99;

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
            name: TranslatedString.create($t(`%yh`) + ' ' + newGroup.settings.name.toString()),
            period: period.getBaseStructure(),
        });

        const migrationData = new V1WaitingListMigrationData();
        migrationData.oldGroupId = originalGroup.id;
        migrationData.oldCycle = cycle;

        if (!dryRun) {
            await newWaitingList.save();
            migrationData.newGroupId = newWaitingList.id;
            await migrationData.save();
        }

        waitingList = newWaitingList;
        return newWaitingList;
    };

    const registrations = await Registration.select()
        .where('groupId', originalGroup.id)
        .andWhere('cycle', cycle)
        .fetch();

    for (const registration of registrations) {
        let invitation: RegistrationInvitation | null = null;

        if (registration.waitingList) {
            const waitingList = await getOrCreateWaitingList();
            if (newGroup.waitingListId !== waitingList.id) {
                newGroup.waitingListId = waitingList.id;

                if (!dryRun) {
                    await newGroup.save();
                }
            }

            registration.groupId = waitingList.id;

            // in V1 registeredAt is not set on waiting list registrations
            registration.registeredAt = registration.createdAt;

            if (registration.canRegister) {
                // we should create an invitation
                invitation = new RegistrationInvitation();
                invitation.groupId = newGroup.id;
                invitation.memberId = registration.memberId;
                invitation.organizationId = organization.id;
                invitation.createdAt = registration.createdAt;

                // deprecated -> set to false
                registration.canRegister = false;
            }
        } else {
            registration.groupId = newGroup.id;
        }

        registration.periodId = period.id;
        registration.cycle = cycle;

        if (!dryRun) {
            await registration.save();
            if (invitation) {
                try {
                    await invitation.save();
                } catch (e) {
                    // do not throw if duplicate
                    if (e.code !== 'ER_DUP_ENTRY') {
                        throw e;
                    }
                }
            }
        }
    }
}

function createPreviousGroup({ originalGroup, period, index }: { originalGroup: Group; period: RegistrationPeriod; index: number }) {
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
    const startDate = new Date(periodStartDate);
    const endDate = new Date(periodEndDate);

    const isPlural = index > 0;
    const extraName = isPlural ? `${index + 1} periodes geleden` : `${index + 1} periode geleden`;

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
