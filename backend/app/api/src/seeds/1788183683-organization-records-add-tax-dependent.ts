import { Migration } from '@simonbackx/simple-database';
import { Organization, Platform } from '@stamhoofd/models';
import { SeedTools } from '../helpers/SeedTools.js';

export default new Migration(async () => {
    if (STAMHOOFD.environment === 'test') {
        console.log('skipped in tests');
        return;
    }

    // for these platforms the data for tax certificates should always be on
    if (['keeo', 'ravot'].includes(STAMHOOFD.platformName.toLowerCase())) {
        const platform = await Platform.getForEditing();
        platform.config.recordsConfiguration.taxDependent = true;
        await platform.save();
        await Platform.clearCache();

        console.log('Enabled tax certificate data on the platform: ' + STAMHOOFD.platformName);
        return;
    }

    if (STAMHOOFD.userMode === 'platform') {
        console.log('Skipped seed organization-records-add-tax-dependent for platform: ' + STAMHOOFD.platformName);
        return;
    }

    await SeedTools.loop({
        query: Organization.select(),
        batchSize: 100,
        action: async (organization) => {
            if (organization.meta.recordsConfiguration.nationalRegisterNumber) {
                organization.meta.recordsConfiguration.taxDependent = true;

                await organization.save({
                    skipMarkSaved: true,
                    skipSendEvents: true,
                });
            }
        },
    });

    return Promise.resolve();
});
