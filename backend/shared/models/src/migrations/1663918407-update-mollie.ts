import { Migration } from '@simonbackx/simple-database';
import { QueueHandler } from '@stamhoofd/queues';
import { MollieToken } from '../models/MollieToken';
import { Organization } from '../models/Organization';

export default new Migration(async () => {
    if (STAMHOOFD.environment == "test") {
        console.log("skipped in tests")
        return;
    }

    const organizations = await Organization.all();

    for (const organization of organizations) {
        if (organization.privateMeta.featureFlags.includes('forceMollie')) {
            continue;
        }
        
        QueueHandler.schedule("migration", async () => {
            const mollie = await MollieToken.getTokenFor(organization.id)
            if (!mollie) {
                return
            }

            console.log('Enabling Mollie feature for '+organization.name);
            const featureFlags = organization.privateMeta.featureFlags.filter(f => f !== 'forceMollie') ?? []
            featureFlags.push('forceMollie')
            organization.privateMeta.featureFlags = featureFlags
            await organization.save()
        }, 25).catch(console.error);
    }

    await QueueHandler.schedule("migration", async () => {
        console.log("Done")
        return Promise.resolve()
    }, 25);
});


