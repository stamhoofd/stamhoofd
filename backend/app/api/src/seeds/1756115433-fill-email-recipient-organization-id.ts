import { Migration } from '@simonbackx/simple-database';
import { Email, EmailRecipient } from '@stamhoofd/models';
import { SQL } from '@stamhoofd/sql';

export default new Migration(async () => {
    if (STAMHOOFD.environment === 'test') {
        console.log('skipped in tests');
        return;
    }

    console.log('Start setting organizationId object on email recipients.');

    const batchSize = 100;
    let count = 0;

    for await (const email of Email.select().where('organizationId', '!=', null).limit(batchSize).all()) {
        if (!email.organizationId) {
            continue;
        }

        await SQL.update(EmailRecipient.table)
            .set('organizationId', email.organizationId)
            .where('emailId', email.id)
            .update();

        count++;
    }

    console.log('Finished saving email recipients of ' + count + ' emails with organization id.');
});
