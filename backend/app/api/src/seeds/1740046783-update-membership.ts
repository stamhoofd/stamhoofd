import { Migration } from '@simonbackx/simple-database';
import { PlatformMembershipService } from '../services/PlatformMembershipService.js';

export default new Migration(async () => {
    if (STAMHOOFD.environment == 'test') {
        console.log('skipped in tests');
        return;
    }

    if (STAMHOOFD.userMode !== 'platform') {
        console.log('skipped seed update-membership because usermode not platform');
        return;
    }

    process.stdout.write('\n');
    await PlatformMembershipService.updateAll();
});
