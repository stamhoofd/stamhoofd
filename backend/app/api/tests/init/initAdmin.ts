import { Organization, Token, UserFactory } from '@stamhoofd/models';
import { AccessRight, PermissionLevel, PermissionRole, Permissions } from '@stamhoofd/structures';
import { initPermissionRole } from './initPermissionRole.js';

/**
 * You cannot assign access rights directy to a user, but it can be done using roles. So when setting accessRights, a role wil be created and assigned to the user.
 */
export async function initAdmin({ organization, permissions, accessRights }: { organization: Organization; permissions?: Permissions; accessRights?: AccessRight[] }) {
    permissions = permissions ?? Permissions.create({
        level: accessRights === undefined ? PermissionLevel.Full : PermissionLevel.None,
    });

    if (accessRights) {
        const role = await initPermissionRole({
            organization,
            accessRights,
        });
        permissions.roles.push(PermissionRole.create(role));
    }

    const admin = await new UserFactory({
        organization,
        permissions,
    }).create();

    const adminToken = await Token.createToken(admin);
    return { admin, adminToken };
}
