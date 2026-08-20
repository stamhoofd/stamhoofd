import { Token, UserFactory } from '@stamhoofd/models';
import { PermissionLevel, Permissions } from '@stamhoofd/structures';
import { SessionService } from '../../src/services/SessionService.js';

export async function initPlatformAdmin() {
    const admin = await new UserFactory({
        globalPermissions: Permissions.create({
            level: PermissionLevel.Full,
        }),
    }).create();

    const adminToken = await SessionService.createSession(admin);
    return { admin, adminToken };
}
