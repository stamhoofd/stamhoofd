import { Migration } from '@simonbackx/simple-database';
import { CachedBalance, Member, Organization, Platform, Registration, User } from '@stamhoofd/models';
import { SeedTools } from '../helpers/SeedTools.js';

export default new Migration(async () => {
    if (STAMHOOFD.environment === 'test') {
        console.log('skipped in tests');
        return;
    }

    if (STAMHOOFD.platformName !== 'stamhoofd') {
        return;
    }

    if (STAMHOOFD.userMode !== 'organization') {
        return;
    }

    // Loop all members
    await SeedTools.loopBatched({
        query: Organization.select(),
        // useTransactionPerBatch: true,
        batchSize: 100,
        batchAction: async (organizations) => {
            for (const organization of organizations) {
                for await (const batch of Member.select('id').where('organizationId', organization.id).limit(1000).allBatched()) {
                    await CachedBalance.updateForMembers(organization.id, batch.map(m => m.id));
                }

                for await (const batch of User.select('id').where('organizationId', organization.id).limit(1000).allBatched()) {
                    await CachedBalance.updateForUsers(organization.id, batch.map(m => m.id));
                }

                for await (const batch of Registration.select('id').where('organizationId', organization.id).limit(1000).allBatched()) {
                    await CachedBalance.updateForRegistrations(organization.id, batch.map(m => m.id));
                }
            }
        },
    });

    const membershipOrganizationId = (await Platform.getShared()).membershipOrganizationId;
    if (membershipOrganizationId) {
        const membershipOrganization = await Organization.getByID(membershipOrganizationId, true);
        await SeedTools.loopBatched({
            query: Organization.select('id').where('id', '!=', membershipOrganization.id),
            // useTransactionPerBatch: true,
            batchSize: 1000,
            batchAction: async (organizations) => {
                await CachedBalance.updateForOrganizations(membershipOrganization.id, organizations.map(m => m.id));
            },
        });
    }

    // await logger.setContext({ tags: ['silent-seed', 'seed'] }, async () => {
    //    for await (const items of BalanceItem.select().limit(10_000).allBatched()) {
    //        await BalanceItemService.updatePaidAndPending(items);
    //        await BalanceItemService.flushAll();
    //
    //        progressLogger.update(items.length);
    //    }
    // });

    // console.log('Updated outstanding balance for ' + progressLogger.total + ' items');

    // Do something here
    return Promise.resolve();
});
