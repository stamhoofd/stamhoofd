import { Organization, Token, UserFactory } from '@stamhoofd/models';
import { PermissionLevel, Permissions } from '@stamhoofd/structures';

export async function initAdmin({ organization }: { organization: Organization }) {
    const admin = await new UserFactory({
        organization,
        permissions: Permissions.create({
            level: PermissionLevel.Full,
        }),
    }).create();

    const adminToken = await Token.createToken(admin);
    return { admin, adminToken };
}
