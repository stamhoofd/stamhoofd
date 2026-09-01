import type { Organization, RegistrationPeriod, User } from '@stamhoofd/models';
import { GroupFactory, OrganizationFactory, OrganizationRegistrationPeriodFactory, Platform, RegistrationPeriodFactory, UserFactory } from '@stamhoofd/models';
import { GroupCategory, GroupCategorySettings, OrganizationRegistrationPeriodSettings, PermissionLevel, PermissionRoleDetailed, Permissions, PermissionsResourceType, ResourcePermissions } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { v4 as uuidv4 } from 'uuid';
import { AdminPermissionChecker } from './AdminPermissionChecker.js';

describe('AdminPermissionChecker.canAccessGroup', () => {
    let previousPeriod: RegistrationPeriod;
    let currentPeriod: RegistrationPeriod;

    beforeEach(async () => {
        TestUtils.setEnvironment('userMode', 'platform');

        previousPeriod = await new RegistrationPeriodFactory({
            startDate: new Date(2023, 0, 1),
            endDate: new Date(2023, 11, 31),
        }).create();

        currentPeriod = await new RegistrationPeriodFactory({
            startDate: new Date(2024, 0, 1),
            endDate: new Date(2024, 11, 31),
        }).create();
    });

    /**
     * An organization that already moved on to currentPeriod, with an admin whose only permissions come
     * from a role. The role is returned empty so the test can grant it what it needs.
     */
    async function createOrganizationWithRole(permissions?: Partial<{ level: PermissionLevel }>) {
        const resources = new Map<PermissionsResourceType, Map<string, ResourcePermissions>>();
        const role = PermissionRoleDetailed.create({ name: 'Test Role', resources, level: permissions?.level ?? PermissionLevel.None });

        const organization = await new OrganizationFactory({ period: currentPeriod, roles: [role] }).create();

        const user = await new UserFactory({
            organization,
            permissions: Permissions.create({
                level: PermissionLevel.None,
                roles: [role],
            }),
        }).create();

        return { organization, user, resources };
    }

    async function createChecker(user: User, organization: Organization) {
        return new AdminPermissionChecker(user, await Platform.getSharedPrivateStruct(), organization);
    }

    test('A grant on a specific group also applies outside the period the organization uses', async () => {
        const { organization, user, resources } = await createOrganizationWithRole();

        const group = await new GroupFactory({ organization, period: previousPeriod }).create();
        const otherGroup = await new GroupFactory({ organization, period: previousPeriod }).create();

        resources.set(PermissionsResourceType.Groups, new Map([[
            group.id,
            ResourcePermissions.create({ level: PermissionLevel.Read }),
        ]]));
        await organization.save();

        const checker = await createChecker(user, organization);

        expect(await checker.canAccessGroup(group)).toBe(true);
        expect(await checker.canAccessGroup(otherGroup)).toBe(false);
    });

    test('A grant on a specific category is resolved in the period the group belongs to', async () => {
        const { organization, user, resources } = await createOrganizationWithRole();

        const group = await new GroupFactory({ organization, period: previousPeriod }).create();

        // Categories are period specific: this category only exists in the period of the group
        const categoryId = uuidv4();
        const organizationPeriod = await new OrganizationRegistrationPeriodFactory({ organization, period: previousPeriod }).create();
        organizationPeriod.settings = OrganizationRegistrationPeriodSettings.create({
            categories: [
                GroupCategory.create({
                    id: categoryId,
                    settings: GroupCategorySettings.create({ name: 'Kapoenen' }),
                    groupIds: [group.id],
                }),
            ],
            rootCategoryId: categoryId,
        });
        await organizationPeriod.save();

        resources.set(PermissionsResourceType.GroupCategories, new Map([[
            categoryId,
            ResourcePermissions.create({ level: PermissionLevel.Read }),
        ]]));
        await organization.save();

        const checker = await createChecker(user, organization);

        expect(await checker.canAccessGroup(group)).toBe(true);
    });

    test('Read access for the whole organization stops at the period the organization uses', async () => {
        const { organization, user } = await createOrganizationWithRole({ level: PermissionLevel.Read });

        const currentGroup = await new GroupFactory({ organization, period: currentPeriod }).create();
        const previousGroup = await new GroupFactory({ organization, period: previousPeriod }).create();

        const checker = await createChecker(user, organization);

        expect(await checker.canAccessGroup(currentGroup)).toBe(true);
        expect(await checker.canAccessGroup(previousGroup)).toBe(false);
    });

    test('The all groups wildcard stops at the period the organization uses', async () => {
        const { organization, user, resources } = await createOrganizationWithRole();

        const currentGroup = await new GroupFactory({ organization, period: currentPeriod }).create();
        const previousGroup = await new GroupFactory({ organization, period: previousPeriod }).create();

        resources.set(PermissionsResourceType.Groups, new Map([[
            '',
            ResourcePermissions.create({ level: PermissionLevel.Read }),
        ]]));
        await organization.save();

        const checker = await createChecker(user, organization);

        expect(await checker.canAccessGroup(currentGroup)).toBe(true);
        expect(await checker.canAccessGroup(previousGroup)).toBe(false);
    });

    test('Full access reaches every period', async () => {
        const { organization, user } = await createOrganizationWithRole({ level: PermissionLevel.Full });

        const previousGroup = await new GroupFactory({ organization, period: previousPeriod }).create();

        const checker = await createChecker(user, organization);

        expect(await checker.canAccessGroup(previousGroup)).toBe(true);
    });
});
