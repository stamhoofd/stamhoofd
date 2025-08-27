import { Migration } from '@simonbackx/simple-database';
import { Email, EmailRecipient } from '@stamhoofd/models';
import { SQL, SQLAlias, SQLCount, SQLSelectAs } from '@stamhoofd/sql';
import { EmailStatus } from '@stamhoofd/structures';

export default new Migration(async () => {
    if (STAMHOOFD.environment === 'test') {
        console.log('skipped in tests');
        return;
    }

    console.log('Start setting counts of emails.');

    const batchSize = 100;
    let count = 0;

    for await (const email of Email.select()
        .where('status', EmailStatus.Sent)
        .where('succeededCount', 0)
        .where('failedCount', 0)
        .where('emailRecipientsCount', '!=', 0)
        .where('emailRecipientsCount', '!=', null)
        .where('createdAt', '<', new Date('2025-08-28 00:00:00')).limit(batchSize).all()) {
        const query = SQL.select(
            new SQLSelectAs(
                new SQLCount(
                    SQL.column('failError'),
                ),
                new SQLAlias('data__failedCount'),
            ),
            // If the current amount_due is negative, we can ignore that negative part if there is a future due item
            new SQLSelectAs(
                new SQLCount(
                    SQL.column('sentAt'),
                ),
                new SQLAlias('data__succeededCount'),
            ),
        )
            .from(EmailRecipient.table)
            .where('emailId', email.id);

        const result = await query.fetch();
        if (result.length !== 1) {
            console.error('Unexpected result', result);
            continue;
        }
        const row = result[0]['data'];
        if (!row) {
            console.error('Unexpected result row', result);
            continue;
        }

        let failedCount = row['failedCount'];
        const succeededCount = row['succeededCount'];

        if (typeof failedCount !== 'number' || typeof succeededCount !== 'number') {
            console.error('Unexpected result values', row);
            return;
        }

        if (email.emailRecipientsCount !== null && failedCount + succeededCount !== email.emailRecipientsCount) {
            console.warn(`Email ${email.id} has ${email.emailRecipientsCount} recipients, but ${failedCount} failed and ${succeededCount} succeeded. Correcting failedCount to `, email.emailRecipientsCount - succeededCount);
            failedCount = email.emailRecipientsCount - succeededCount;
        }

        // Send an update query
        await Email.update()
            .where('id', email.id)
            .set('succeededCount', succeededCount)
            .set('failedCount', failedCount)
            .update();
        count += 1;
    }

    console.log('Finished saving ' + count + ' emails.');
});
