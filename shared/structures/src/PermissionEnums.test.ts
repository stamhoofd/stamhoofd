import { ObjectData } from '@simonbackx/simple-encoding';
import { AccessRight } from '@stamhoofd/types/AccessRight';
import { PermissionLevel } from '@stamhoofd/types/PermissionLevel';
import { PermissionsResourceType } from '@stamhoofd/types/PermissionsResourceType';
import { Permissions } from './Permissions.js';
import { ResourcePermissions } from './ResourcePermissions.js';
import { Version } from './Version.js';

describe('Unit.PermissionEnums', () => {
    test.each([417, Version])('preserves serialized permissions at version %s', (version) => {
        const serialized = {
            level: 'Full',
            roles: [],
            responsibilities: [],
            resources: {
                RecordCategory: {
                    category: { n: '', l: 'Read', r: ['MemberManageNRN'] },
                },
            },
        };
        const permissions = Permissions.decode(new ObjectData(serialized, { version }));

        expect(permissions.level).toBe(PermissionLevel.Full);
        expect(permissions.resources.get(PermissionsResourceType.RecordCategories)?.get('category')).toEqual(ResourcePermissions.create({
            level: PermissionLevel.Read,
            accessRights: [AccessRight.MemberManageNRN],
        }));
        expect(permissions.encode({ version })).toEqual(serialized);
    });
});
