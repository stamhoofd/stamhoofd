import { Organization } from '@stamhoofd/models';
import { AccessRight, PermissionRoleDetailed } from '@stamhoofd/structures';

export async function initPermissionRole({ organization, accessRights }: { organization: Organization; accessRights?: AccessRight[] }): Promise<PermissionRoleDetailed> {
    const role = PermissionRoleDetailed.create({
        name: 'Test role',
        accessRights,
    });
    organization.privateMeta.roles.push(role);
    await organization.save();
    return role;
}
