import { Migration } from '@simonbackx/simple-database';
import { User } from '@stamhoofd/models';
import { NewUser, PermissionLevel, Permissions, UserPermissions } from '@stamhoofd/structures';

export default new Migration(async () => {
    if (STAMHOOFD.environment !== 'development') {
        console.log('Skipped');
        return;
    }

    // Check if total users is 0
    const totalUsers = await User.select().count();
    if (totalUsers > 0) {
        console.log('Skipped, users already exist');
        return;
    }

    // Create a development user with platform level admin access
    const user = await User.register(
        null, // No organization
        NewUser.create({
            id: '00000000-0000-4000-8000-000000000000',
            firstName: 'Stamhoofd',
            lastName: 'Development',
            email: 'hallo@stamhoofd.be',
            password: 'stamhoofd',
        }),
        { allowPlatform: true },
    );

    if (!user) {
        throw new Error('Failed to create development user');
    }

    user.verified = true;
    user.permissions = UserPermissions.create({
        globalPermissions: Permissions.create({
            level: PermissionLevel.Full,
        }),
    });
    await user.save();

    console.log('Created a new development user:');
    console.log('E-mail:', user.email);
    console.log('Password: stamhoofd');

    // Do something here
    return Promise.resolve();
});
