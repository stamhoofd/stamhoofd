import { Migration } from '@simonbackx/simple-database';
import { Organization } from '@stamhoofd/models';
import { SeedTools } from '../helpers/SeedTools.js';

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

    await migrateOrganizations();
});

async function migrateOrganizations() {
    console.log('Start updating organizations.');

    const realUpdate = 0;
    const result = await SeedTools.loop({
        query: Organization.select(),
        batchSize: 200,
        useTransactionPerBatch: true,
        action: async (organization: Organization) => {
            if (organization.meta.companies.length && !organization.meta.companies[0].address) {
                for (const c of organization.meta.companies) {
                    if (!c.address) {
                        c.address = organization.address;
                    }
                }
                await organization.save();
            }
        },
    });

    console.log('Updated ' + realUpdate + ' organizations out of ' + result.total + ' looped organizations');
}
