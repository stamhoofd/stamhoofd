import { Migration } from '@simonbackx/simple-database';
import { Email } from '@stamhoofd/models';
import { EmailStatus } from '@stamhoofd/structures';

export default new Migration(async () => {
    if (STAMHOOFD.environment === 'test') {
        console.log('skipped in tests');
        return;
    }

    const { affectedRows } = await Email.delete()
        .where('status', EmailStatus.Draft)
        .where('createdAt', '<', new Date(Date.now() - 1000 * 60 * 60 * 24 * 30)) // older than 30 days
        .delete();
    console.log('Deleted ' + affectedRows + ' old draft emails.');
});
