import { Migration } from '@simonbackx/simple-database';
import { Group, Organization, OrganizationRegistrationPeriod, V1GroupMigrationData } from '@stamhoofd/models';
import { GroupCategory, GroupCategorySettings, GroupType } from '@stamhoofd/structures';
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

// only check organizations that were checked in the 'fix' migration
const relevantOrganizations = new Set(['f2543d6b-523e-4b03-848b-838200b1ff41', '11a478dd-e8cf-4160-80dd-8b48d20a6d39', '6d1c32cf-2ef0-4738-bacb-d553488f97b9', '3e6f5cb9-e130-4dda-92c9-26682fa09509', '57815733-5750-492f-beb1-1efd6229803a', '7677e32d-763a-4033-bc74-30d13f27556d', '7ac75a0f-f365-4ddc-836c-66a3267f24f0', '9dced404-a92d-44c4-b301-ecd29b6ac4e0', '97928f8a-b8d1-44cc-918f-09d0ae896c3b', 'f0edb665-1ce0-442a-88e7-5a62ea78c5fc', '842ada22-82f3-4cef-a1da-ae5da20b208d', '33744473-9ad9-4d3e-a9fc-31cd1b6a2753', 'ed6e74f1-51a0-4e04-8195-e722b015eeb5', '10827cc5-5f29-46cf-b26e-5fd11a9342cc', '5f4d4a26-43c3-4f80-86ad-64d07d5a46a7', '74e2bcbf-0ff9-484b-988a-e11d147122c0', 'c69512bc-ea0c-427a-ab90-08c3dcf1c856', '16742d64-0b31-4ce7-9c1e-6194882045b9', '95d59803-c50e-4bc1-adc9-90ade32b7579', 'eb6ccffa-41c5-45df-b4e4-1eb5749bc0fe', '1a534005-2784-400c-b8fe-bde09c901259', '27e06924-49a6-468c-a16e-b5735ace1894', '7a86f3db-08d8-4752-a77d-eb85f2167942', 'f562c735-7bf4-4e2e-8c0f-6584e8e96a1d', 'e2afe517-cd35-4d9e-a561-125ad184a2ff', 'fd934e40-734c-442d-b338-c3ae288dd55d']);

// only check groups that were checked in the 'fix' migration
const relevantGroups = new Set([
    '020a313c-0e97-4068-84ba-783d91e768a4', '02420f62-1a07-4e2a-ae92-13c35320fb27', '0b6d8422-857f-46e4-a632-a4af322c9193', '12ba896a-e064-4697-a5df-69664c9bd8cb', '134e33f9-3560-4eca-977b-aaef01af5ed4', '1a9bb59a-c85a-4338-94c6-f82061f1ee0e', '1bf5519d-4645-4c51-8ae5-7a202bb74e9e', '1c86c401-c32b-4c6f-a2b5-fb15649efa74', '1ddc6fde-f512-43ac-8e15-2496601e900e', '20cab6ae-fb30-4de8-948e-60caf0979ff7', '22194f9d-fba2-4497-b7b0-de8ba6e884ff', '2384f112-d50d-4fcf-b6f2-45db73a8944c', '26693e8a-b73d-4f28-a41c-d281ba91fb3e', '287ff7b8-3319-40fb-ad25-26b139db3272', '2e473bf7-36f9-4276-8770-032db776d154', '3282e30c-a3db-4f00-b827-646fcc532c43', '3490cfd8-4c0b-487f-8f0d-c96c62950160', '3d68762b-8133-42e0-a642-7649864b09b3', '4a7d205b-e996-4841-b21c-1336642e670d', '52b0285c-4935-4577-bc7b-30d0b8804fc9', '579263b6-ceb1-4be0-a31e-9a4a904f0cae', '5870423f-6faf-492e-accb-4bd110365328', '60e24adb-5bb3-48de-9008-5b80c905a01a', '6535d9b4-f2ad-4f7e-b7e2-9e50ddf5eff6', '6a508234-08aa-4b0b-9647-7aeb9d80fa5a', '722f3bdf-d9df-4a78-a4c1-783c9af3d21b', '754bb111-caad-49b3-8dde-5bd0f3ad9104', '76aef892-19b5-4deb-9276-0c6b19b652fd', '78fa525b-e346-4b78-9e25-f9b1b5134b77', '7989ea9d-354d-4eff-9350-8eb8a6c4732b', '7aba3792-0138-4302-8550-2ccb456a37ad', '7c480cd5-8db3-4c03-8f0b-a88556df0234', '8113c2a2-e788-4f11-815f-4b019d7ca966', '82958c24-bc12-45f2-9d0d-3c8b902df052', '88c28670-cf97-42e2-ae9e-d836d349c2e6', '88d87c1a-749f-453c-a60b-e54a7001a9f0', '8983c1d5-e8aa-4628-a251-17220336fad5', '89ced76d-8c98-4f83-bffa-8b467289972d', '8abed111-cda2-4bb8-8d98-21291a85fb4f', '8bb9b1c6-2d40-4a69-bbd5-63ce152b1a91', '8f98e452-e174-4946-96ec-888cc3498f56', '8fdffd17-84fa-41f7-8b74-744578d4b9d9', '92ae627b-8aa4-4197-885e-603d4a1be8aa', '9852662c-7e9f-4c26-a6d3-6335b49b9b3b', 'a06ddcb5-dc9c-4bec-a0f8-40fd4ab20016', 'a25bbeae-86b9-4162-8570-d121845f26e9', 'a690c59b-72eb-40bb-b181-d9dc904f9ec1', 'a9b0a795-3b7e-40bb-b8ec-65280d149dba', 'ab9ddbb9-21bc-4a8e-be7f-036554b70db4', 'bea51786-4d47-4bcb-bf79-fc636f047cbb', 'c806a74d-f0ae-4473-86bd-facb92085eb1', 'c9064135-322e-4848-9de0-61011d067697', 'cb7e738f-bcb5-4bc5-9962-2608ea9c4094', 'cbc21e01-bb7e-4f1d-94c8-d4aac3b7247d', 'cf766627-3e32-45a1-8d62-865b6cc1d4ed', 'd0cf99ce-24e9-4912-9dc8-660b4ff57dcc', 'd2a536af-f23d-4c3e-8275-dc2e5116ab60', 'd715451c-6292-4d58-83f8-ffce115fca21', 'd76b57b8-10c4-43e4-94d1-bb66d1053bb4', 'dcffb511-131b-401c-a4b5-13810596bc42', 'df010c46-fc79-401c-a4a4-1fddb478acff', 'dfaf11b8-f835-4952-99e1-2b0279931b05', 'e0b8e823-4213-4919-b1ed-70395ad15df2', 'e9470495-097c-47b5-8e63-cd4f7370fa2d', 'e9fe89f8-780b-417f-a4ee-b48e0b0bb8ad', 'eda36826-ee68-414d-a773-cb41e1a1e2d6', 'edaa90fa-869b-4f3c-8b90-4ea41fe9a364', 'f163d78a-9539-43a3-aeb7-443559599342', 'f24e2ca9-3036-4839-9ff4-91bd4ecb5c91', 'f665642c-93e7-4886-bd6e-f94252d54e77', 'f7e5436c-855d-4bf9-b2de-94e9d0fd3052', 'f822b26a-715a-4154-b2a2-b11e38373fad', 'fe2e4ec5-cee4-4648-ae87-2f8dee7f42c8', 'ff3a7e68-feb7-4aca-983d-a8f8315851e7',
]);

async function start(dryRun: boolean) {
    await SeedTools.loop({
        query: Organization.select(),
        batchSize: 50,
        useTransactionPerBatch: true,
        action: async (organization: Organization) => {
            if (!relevantOrganizations.has(organization.id)) {
                return;
            }

            await createMissingGroupCategories(organization, dryRun);
        },
    });
}

async function createMissingGroupCategories(organization: Organization, dryRun: boolean) {
    const organizationPeriods = await OrganizationRegistrationPeriod.select()
        .where('organizationId', organization.id)
        // exclude current period
        .andWhereNot('periodId', organization.periodId)
        .fetch();

    if (organizationPeriods.length > 1) {
        console.error('found multiple periods for organization: ' + organization.id);
    }

    for (const organizationPeriod of organizationPeriods) {
        const groups: Group[] = await Group.select()
            .where('organizationId', organization.id)
            // only for period being looped
            .andWhere('periodId', organizationPeriod.periodId)
            .andWhere('type', GroupType.Membership)
            .andWhere('deletedAt', null)
            .fetch();

        if (groups.length === 0) {
            continue;
        }

        const allCategories = organizationPeriod.settings.categories;

        for (const group of groups) {
            const category = allCategories.find(c => c.groupIds.includes(group.id));

            // only create missing category if group is not in any category yet
            if (!category) {
                const oldGroupId = await getOldGroupId(group);
                if (!relevantGroups.has(oldGroupId)) {
                    throw new Error('not expected');
                }

                const oldGroup = await Group.getByID(oldGroupId);
                if (!oldGroup) {
                    throw new Error('Old group not found: ' + oldGroupId);
                }

                const { path, organizationPeriod: currentOrganizationPeriod } = await findPath(oldGroup);

                const allArchivedCategories = organizationPeriod.settings.categories;

                const archivedRoot = organizationPeriod.settings.rootCategory;
                if (!archivedRoot) {
                    throw new Error('archived root category not found');
                }
                let thisLayer = getChildCategories(archivedRoot, allArchivedCategories);
                const equalArchivedPath: GroupCategory[] = [organizationPeriod.settings.rootCategory!];

                for (const currentPeriodCategory of path) {
                    if (currentPeriodCategory === currentOrganizationPeriod.settings.rootCategory) {
                        continue;
                    }

                    // only exact match for last category is needed
                    const exactMatch = currentPeriodCategory !== path[path.length - 1];
                    const equalArchivedCategories = thisLayer.filter(archivedCategory => isEqualCategory(currentPeriodCategory, archivedCategory, exactMatch));
                    if (equalArchivedCategories.length > 1) {
                        throw new Error(`Found multiple equal categories (${currentPeriodCategory.settings.name}): ` + equalArchivedCategories.map(c => c.settings.name).join(', '));
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
                        throw new Error('not expected last category has group ids');
                    }

                    // create new category
                    const newCategory = createCategoryForOriginalGroup(oldGroup, [group.id]);
                    lastCategory.categoryIds.push(newCategory.id);
                    organizationPeriod.settings.categories.push(newCategory);

                    if (!dryRun) {
                        await organizationPeriod.save();
                    }
                } else {
                    // should not happen
                    console.error('no complete match');
                }
            }
        }
    }
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

async function getOldGroupId(group: Group) {
    const data = await V1GroupMigrationData.select().where('newGroupId', group.id).first(true);
    return data.oldGroupId;
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

function logPath(path: GroupCategory[], prefix: string): void {
    console.log(`${prefix} path: ${path.map(c => c.settings.name).join(' > ')}`);
}

function isEqualCategory(currentPeriodCategory: GroupCategory, archivedPeriodCategory: GroupCategory, exactMatch: boolean) {
    if (exactMatch) {
        return archivedPeriodCategory.settings.name === currentPeriodCategory.settings.name;
    }
    return archivedPeriodCategory.settings.name.startsWith(currentPeriodCategory.settings.name);
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
