import { Organization, Platform } from '@stamhoofd/models';
import { AccessRight, PermissionRoleDetailed } from '@stamhoofd/structures';

export async function initPermissionRole(
    { organization, accessRights }:
    { organization?: Organization; accessRights?: AccessRight[] },
): Promise<PermissionRoleDetailed> {
    const role = PermissionRoleDetailed.create({
        name: 'Test role',
        accessRights,
    });
    if (organization) {
        organization.privateMeta.roles.push(role);
        await organization.save();
    }
    else {
        const platform = await Platform.getForEditing();
        platform.privateConfig.roles.push(role);
        await platform.save();
    }
    return role;
}
