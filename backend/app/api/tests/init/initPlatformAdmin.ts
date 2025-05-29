import { Token, UserFactory } from '@stamhoofd/models';
import { PermissionLevel, Permissions } from '@stamhoofd/structures';

export async function initPlatformAdmin() {
    const admin = await new UserFactory({
        globalPermissions: Permissions.create({
            level: PermissionLevel.Full,
        }),
    }).create();

    const adminToken = await Token.createToken(admin);
    return { admin, adminToken };
}
