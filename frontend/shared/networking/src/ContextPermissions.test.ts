import { Group, GroupCategory, GroupCategorySettings, GroupSettings, GroupType, Organization, OrganizationMetaData, OrganizationRegistrationPeriod, OrganizationRegistrationPeriodSettings, PermissionLevel, PermissionsResourceType, Permissions, Platform, RegistrationPeriod, ResourcePermissions, TranslatedString, UserPermissions, UserWithMembers } from '@stamhoofd/structures';
import { describe, expect, test } from 'vitest';
import { ContextPermissions } from './ContextPermissions.ts';

describe('ContextPermissions.canAccessGroup', () => {
    const organizationId = '11111111-1111-4111-8111-111111111111';
    const categoryId = '22222222-2222-4222-8222-222222222222';

    /**
     * An organization on `currentPeriod` that also has a previous period. Both periods hold one
     * membership group inside a category, and only the category is granted to the user.
     */
    function setup() {
        function createPeriod(name: string, startYear: number) {
            const period = RegistrationPeriod.create({
                startDate: new Date(startYear, 8, 1),
                endDate: new Date(startYear + 1, 7, 31),
            });

            const group = Group.create({
                organizationId,
                periodId: period.id,
                type: GroupType.Membership,
                settings: GroupSettings.create({ name: TranslatedString.create(name) }),
            });

            const category = GroupCategory.create({
                // The same category id across periods: only the groupIds differ
                id: categoryId,
                settings: GroupCategorySettings.create({ name: 'Leeftijdsgroepen' }),
                groupIds: [group.id],
            });

            const organizationPeriod = OrganizationRegistrationPeriod.create({
                period,
                settings: OrganizationRegistrationPeriodSettings.create({ categories: [category] }),
                groups: [group],
            });

            return { period, group, organizationPeriod };
        }

        const previous = createPeriod('Vorig werkjaar', 2024);
        const current = createPeriod('Huidig werkjaar', 2025);

        const organization = Organization.create({
            id: organizationId,
            name: 'Test',
            uri: 'test',
            meta: OrganizationMetaData.create({}),
            period: current.organizationPeriod,
        });

        const permissions = Permissions.create({
            level: PermissionLevel.None,
            resources: new Map([[
                PermissionsResourceType.GroupCategories,
                new Map([[categoryId, ResourcePermissions.create({ level: PermissionLevel.Full })]]),
            ]]),
        });

        const user = UserWithMembers.create({
            email: 'test@example.com',
            permissions: UserPermissions.create({
                organizationPermissions: new Map([[organizationId, permissions]]),
            }),
        });

        const auth = new ContextPermissions(user, organization, Platform.create({}));

        return {
            auth,
            organization,
            previousGroup: previous.group,
            previousPeriod: previous.organizationPeriod,
            currentGroup: current.group,
            currentPeriod: current.organizationPeriod,
        };
    }

    test('A category grant reaches a group of the current period without passing a period', () => {
        const { auth, currentGroup } = setup();

        expect(auth.canAccessGroup(currentGroup, PermissionLevel.Full)).toBe(true);
    });

    test('A category grant reaches a group of a previous period when its period is passed', () => {
        const { auth, previousGroup, previousPeriod } = setup();

        // The backend resolves the categories in the group's own period, so the frontend must too
        expect(auth.canAccessGroup(previousGroup, PermissionLevel.Full, undefined, previousPeriod)).toBe(true);
    });

    test('A period of another group is ignored instead of answering for the wrong period', () => {
        const { auth, previousGroup, currentPeriod } = setup();

        expect(auth.canAccessGroup(previousGroup, PermissionLevel.Full, undefined, currentPeriod)).toBe(false);
    });
});
