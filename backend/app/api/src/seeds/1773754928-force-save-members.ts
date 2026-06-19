import { Migration } from '@simonbackx/simple-database';
import { Member } from '@stamhoofd/models';
import { SeedTools } from '../helpers/SeedTools.js';
import { QueryableModel } from '@stamhoofd/sql';

export default new Migration(async () => {
    if (STAMHOOFD.environment === 'test') {
        // The customer determination is covered directly by PaymentCustomerResolver.test.ts
        console.log('skipped in tests');
        return;
    }

    if (STAMHOOFD.platformName !== 'stamhoofd') {
        // In v1 only the Stamhoofd platform stored payments without a customer.
        return;
    }

    process.stdout.write('\n');

    await migrateMembers();
});

async function migrateMembers() {
    console.log('Start updating members.');

    let realUpdate = 0;
    const result = await SeedTools.loop({
        query: Member.select().where('updatedAt', '<', new Date(Date.now() - 1_000 * 60 * 60 * 5)),
        batchSize: 200,
        useTransactionPerBatch: true,
        action: async (member: Member) => {
            member.forceSaveProperty('details');

            if (await member.save({
                skipMarkSaved: true,
                skipSendEvents: true,
            })) {
                realUpdate += 1;
            }

            if (QueryableModel.shutdownMigrations) {
                throw new Error('Stopping migration gracefully');
            }
        },
    });

    console.log('Updated ' + realUpdate + ' members out of ' + result.total + ' looped members');
}
