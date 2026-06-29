import { Migration } from '@simonbackx/simple-database';
import { Organization } from '@stamhoofd/models';

export default new Migration(async () => {
    if (STAMHOOFD.environment === 'test') {
        console.log('skipped in tests');
        return;
    }

    await Organization.updateFutureEventsForOrganizations('all');
});
