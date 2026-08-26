import { describe, expect, test } from 'vitest';
import { Group } from '../Group.js';
import { GroupCategory, GroupCategorySettings } from '../GroupCategory.js';
import { LoadedPermissions } from '../LoadedPermissions.js';
import { PermissionLevel } from '../PermissionLevel.js';
import { PermissionRoleDetailed } from '../PermissionRole.js';
import { PermissionsResourceType } from '../PermissionsResourceType.js';
import { OrganizationRegistrationPeriod, RegistrationPeriod } from '../RegistrationPeriod.js';
import { ResourcePermissions } from '../ResourcePermissions.js';
import { PeriodAccessHelper } from './PeriodAccessHelper.js';

describe('PeriodAccessHelper.isPeriodAccessible', () => {
    function createPeriod() {
        const group = Group.create({ periodId: 'period-1' });
        const category = GroupCategory.create({
            settings: GroupCategorySettings.create({ name: 'Kapoenen' }),
            groupIds: [group.id],
        });

        const period = OrganizationRegistrationPeriod.create({
            period: RegistrationPeriod.create({}),
            groups: [group],
        });
        period.settings.categories = [category];
        period.settings.rootCategoryId = category.id;

        return { period, group };
    }

    function createRolePermissions(resources: Map<PermissionsResourceType, Map<string, ResourcePermissions>>) {
        return LoadedPermissions.fromRole(PermissionRoleDetailed.create({ name: 'Test Role', resources }));
    }

    test('Without permissions no period is accessible', () => {
        const { period } = createPeriod();

        expect(PeriodAccessHelper.isPeriodAccessible(period, null)).toBe(false);
    });

    test('A full admin can access every period', () => {
        const { period } = createPeriod();
        const permissions = LoadedPermissions.create({ level: PermissionLevel.Full });

        expect(PeriodAccessHelper.isPeriodAccessible(period, permissions)).toBe(true);
    });

    test('A role that was granted a group of the period can access it', () => {
        const { period, group } = createPeriod();
        const permissions = createRolePermissions(new Map([[
            PermissionsResourceType.Groups,
            new Map([[group.id, ResourcePermissions.create({ level: PermissionLevel.Read })]]),
        ]]));

        expect(PeriodAccessHelper.isPeriodAccessible(period, permissions)).toBe(true);
    });

    test('A role that was only granted a group of another period cannot access it', () => {
        const { period } = createPeriod();
        const permissions = createRolePermissions(new Map([[
            PermissionsResourceType.Groups,
            new Map([['a-group-of-another-period', ResourcePermissions.create({ level: PermissionLevel.Read })]]),
        ]]));

        expect(PeriodAccessHelper.isPeriodAccessible(period, permissions)).toBe(false);
    });
});
