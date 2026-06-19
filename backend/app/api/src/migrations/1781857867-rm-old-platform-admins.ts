import { Migration } from '@simonbackx/simple-database';
import { User } from '@stamhoofd/models';

export default new Migration(async () => {
    if (STAMHOOFD.environment === 'test') {
        console.log('skipped in tests');
        return;
    }

    if (STAMHOOFD.platformName !== 'stamhoofd') {
        return;
    }

    if (STAMHOOFD.userMode !== 'organization') {
        return;
    }

    // Replaced with new global admins
    await User.delete().where('email', 'hallo@stamhoofd.be');
    await User.delete().where('email', 'hallo@stamhoofd.nl');
});
