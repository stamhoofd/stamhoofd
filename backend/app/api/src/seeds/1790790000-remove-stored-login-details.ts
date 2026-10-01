import { Migration } from '@simonbackx/simple-database';
import { EmailRecipient } from '@stamhoofd/models';
import { QueryableModel, scalarToSQLExpression, SQL, SQLWhereLike } from '@stamhoofd/sql';

import { SeedTools } from '../helpers/SeedTools.js';

/**
 * Removes the security codes that were stored in the loginDetails replacement of sent email recipients.
 */
export async function removeStoredLoginDetails() {
    let count = 0;

    await SeedTools.loopBatched({
        query: EmailRecipient.select()
            .where(new SQLWhereLike(SQL.column(EmailRecipient.table, 'replacements'), scalarToSQLExpression('%"loginDetails"%'))),
        batchSize: 100,
        batchAction: async (recipients: EmailRecipient[]) => {
            for (const recipient of recipients) {
                // beforeSave of the replacements column removes loginDetails
                if (await recipient.save()) {
                    count++;
                }

                if (QueryableModel.shutdownMigrations) {
                    throw new Error('Stopping migration gracefully');
                }
            }
        },
    });

    return count;
}

export default new Migration(async () => {
    if (STAMHOOFD.environment === 'test') {
        console.log('skipped in tests');
        return;
    }

    console.log('Start removing stored loginDetails from email recipients.');
    const count = await removeStoredLoginDetails();
    console.log(`Finished removing stored loginDetails from ${count} email recipients.`);
});
