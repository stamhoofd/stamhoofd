import { Organization, Token, UserFactory } from '@stamhoofd/models';
import { PermissionLevel, Permissions } from '@stamhoofd/structures';

export async function initAdmin({ organization, permissions }: { organization: Organization; permissions?: Permissions }) {
    const admin = await new UserFactory({
        organization,
        permissions: permissions ?? Permissions.create({
            level: PermissionLevel.Full,
        }),
    }).create();

    const adminToken = await Token.createToken(admin);
    return { admin, adminToken };
}
