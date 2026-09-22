import { AccessRight } from './AccessRight.js';
import { PermissionLevel } from './PermissionLevel.js';
import { PermissionRoleDetailed } from './PermissionRole.js';
import { PermissionsResourceKey, PermissionsResourceType } from './PermissionsResourceType.js';
import { ResourcePermissions } from './ResourcePermissions.js';

describe('Unit.PermissionRoleDetailed', () => {
    describe('compress', () => {
        function createRole(options: {
            level?: PermissionLevel;
            accessRights?: AccessRight[];
            groups?: Record<string, ResourcePermissions>;
        }) {
            const resources = new Map<PermissionsResourceType, Map<string, ResourcePermissions>>();

            if (options.groups) {
                resources.set(PermissionsResourceType.Groups, new Map(Object.entries(options.groups)));
            }

            return PermissionRoleDetailed.create({
                name: 'Test Role',
                level: options.level ?? PermissionLevel.None,
                accessRights: options.accessRights ?? [],
                resources,
            });
        }

        function groups(role: PermissionRoleDetailed) {
            return role.resources.get(PermissionsResourceType.Groups);
        }

        const read = () => ResourcePermissions.create({ level: PermissionLevel.Read });

        test('A full role keeps no access rights or resources', () => {
            const role = createRole({
                level: PermissionLevel.Full,
                accessRights: [AccessRight.OrganizationCreateGroups],
                groups: { 'group-1': read() },
            });

            role.compress();

            expect(role.accessRights).toEqual([]);
            expect(role.resources.size).toBe(0);
        });

        test('Removes a specific resource that $all already covers, and keeps $all', () => {
            const role = createRole({
                groups: {
                    [PermissionsResourceKey.All]: read(),
                    'group-1': read(),
                },
            });

            role.compress();

            expect(groups(role)?.get('group-1')).toBeUndefined();
            expect(groups(role)?.get(PermissionsResourceKey.All)).toBeDefined();
        });

        test('Removes $all when the base level of the role already covers it', () => {
            const role = createRole({
                level: PermissionLevel.Write,
                groups: { [PermissionsResourceKey.All]: read() },
            });

            role.compress();

            // The whole type is dropped once nothing is left in it
            expect(role.resources.get(PermissionsResourceType.Groups)).toBeUndefined();
        });

        test('Keeps $currentPeriod even when it is already covered', () => {
            const role = createRole({
                groups: {
                    [PermissionsResourceKey.All]: ResourcePermissions.create({ level: PermissionLevel.Full }),
                    [PermissionsResourceKey.CurrentPeriod]: read(),
                },
            });

            role.compress();

            // The current period changes over time, so this grant is not folded into $all
            expect(groups(role)?.get(PermissionsResourceKey.CurrentPeriod)).toBeDefined();
        });

        test('Keeps a specific group that only $currentPeriod covers', () => {
            const role = createRole({
                groups: {
                    [PermissionsResourceKey.CurrentPeriod]: ResourcePermissions.create({ level: PermissionLevel.Full }),
                    'group-1': read(),
                },
            });

            role.compress();

            // $currentPeriod only reaches the groups of the current period, which is not knowable here
            expect(groups(role)?.get('group-1')).toBeDefined();
        });

        test('Keeps an access right that the covering level does not imply', () => {
            const role = createRole({
                level: PermissionLevel.Write,
                groups: {
                    'group-1': ResourcePermissions.create({
                        level: PermissionLevel.Read,
                        // Never granted by a level, so a Write base level does not cover it
                        accessRights: [AccessRight.OrganizationEventNotificationReviewer],
                    }),
                },
            });

            role.compress();

            expect(groups(role)?.get('group-1')).toBeDefined();
        });

        test('Removes an access right that the covering level does imply', () => {
            const role = createRole({
                level: PermissionLevel.Write,
                groups: {
                    'group-1': ResourcePermissions.create({
                        level: PermissionLevel.Read,
                        // Automatically granted from Write upwards
                        accessRights: [AccessRight.WebshopScanTickets],
                    }),
                },
            });

            role.compress();

            expect(role.resources.get(PermissionsResourceType.Groups)).toBeUndefined();
        });

        test('Removes empty resources', () => {
            const role = createRole({
                groups: {
                    'group-1': ResourcePermissions.create({ level: PermissionLevel.None }),
                    [PermissionsResourceKey.CurrentPeriod]: ResourcePermissions.create({ level: PermissionLevel.None }),
                },
            });

            role.compress();

            expect(role.resources.get(PermissionsResourceType.Groups)).toBeUndefined();
        });
    });
});
