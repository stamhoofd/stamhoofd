import { AccessRight } from './AccessRight';
import { LoadedPermissions } from './LoadedPermissions';
import { MemberResponsibility } from './MemberResponsibility';
import { MemberResponsibilityRecordBase } from './members/MemberResponsibilityRecord';
import { PermissionLevel } from './PermissionLevel';
import { PermissionRoleForResponsibility } from './PermissionRole';
import { Permissions } from './Permissions';
import { PermissionsResourceType } from './PermissionsResourceType';
import { ResourcePermissions } from './ResourcePermissions';

describe('Unit.LoadedPermissions', () => {
    describe('LoadedPermissions.from', () => {
        test('[Regression] Does not alter the original responsibilities', () => {
            const allTags = ResourcePermissions.create({
                level: PermissionLevel.Read,
                accessRights: [],
            });

            const specificTag = ResourcePermissions.create({
                level: PermissionLevel.Write,
                accessRights: [
                    AccessRight.OrganizationEventNotificationReviewer,
                ],
            });

            const responsibility = MemberResponsibility.create({
                id: 'resp-1',
                name: 'Functienaam',
                permissions: PermissionRoleForResponsibility.create({
                    responsibilityId: 'resp-1',
                    level: PermissionLevel.Read,
                    accessRights: [AccessRight.MemberReadFinancialData],
                    resources: new Map([
                        [PermissionsResourceType.OrganizationTags, new Map([
                            ['my-id', allTags],
                        ])],
                    ]),
                }),
            });

            const responsibility2 = MemberResponsibility.create({
                id: 'resp-2',
                name: 'Specifieke met access rights',
                permissions: PermissionRoleForResponsibility.create({
                    level: PermissionLevel.Write,
                    responsibilityId: 'resp-2',
                    accessRights: [AccessRight.WebshopScanTickets],
                    resources: new Map([
                        [PermissionsResourceType.OrganizationTags, new Map([
                            ['my-id', specificTag],
                        ])],
                    ]),
                }),
            });

            const result = LoadedPermissions.from(
                Permissions.create({
                    level: PermissionLevel.Write,
                    responsibilities: [
                        MemberResponsibilityRecordBase.create({
                            responsibilityId: responsibility.id,
                            memberId: 'member-id',
                            groupId: null,
                            startDate: new Date(0),
                            endDate: null,
                        }),
                        MemberResponsibilityRecordBase.create({
                            responsibilityId: responsibility2.id,
                            memberId: 'member-id',
                            groupId: null,
                            startDate: new Date(0),
                            endDate: null,
                        }),
                    ],
                }),
                [],
                [],
                [responsibility, responsibility2],
            );

            // Check result
            expect(result.accessRights).toEqual([
                AccessRight.MemberReadFinancialData,
                AccessRight.WebshopScanTickets,
            ]);
            expect(result.level).toBe(PermissionLevel.Write);
            expect(result.resources.get(PermissionsResourceType.OrganizationTags)?.get('my-id')?.level).toBe(PermissionLevel.Write);
            expect(result.resources.get(PermissionsResourceType.OrganizationTags)?.get('my-id')?.accessRights).toEqual([
                AccessRight.OrganizationEventNotificationReviewer,
            ]);

            // Check responsibility not altered
            expect(responsibility.permissions?.level).toBe(PermissionLevel.Read);
            expect(responsibility.permissions?.accessRights).toEqual([AccessRight.MemberReadFinancialData]);
            expect(allTags.level).toBe(PermissionLevel.Read);
            expect(allTags.accessRights).toEqual([]);

            expect(responsibility2.permissions?.level).toBe(PermissionLevel.Write);
            expect(responsibility2.permissions?.accessRights).toEqual([
                AccessRight.WebshopScanTickets,
            ]);

            expect(specificTag.level).toBe(PermissionLevel.Write);
            expect(specificTag.accessRights).toEqual([
                AccessRight.OrganizationEventNotificationReviewer,
            ]);
        });
    });
});
