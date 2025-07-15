import { Migration } from '@simonbackx/simple-database';
import { EmailTemplate } from '@stamhoofd/models';

export default new Migration(async () => {
    if (STAMHOOFD.environment !== 'development' && STAMHOOFD.platformName.toLowerCase() !== 'stamhoofd') {
        console.log('Skipped');
        return;
    }

    console.log('Deleting all default email templates');
    await EmailTemplate.delete()
        .where('organizationId', null);
});
