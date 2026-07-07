import { Migration } from '@simonbackx/simple-database';
import { Platform } from '@stamhoofd/models';

export default new Migration(async () => {
    if (STAMHOOFD.environment === 'test') {
        console.log('skipped in tests');
        return;
    }

    const platform = await Platform.getForEditing();

    if (!platform.config.featureFlags.includes('uitpas')) {
        console.log('Platform does not have the uitpas feature flag, nothing to migrate');
        return;
    }

    // The uitpas (UiTPAS social tariff on webshops) feature flag is now controlled
    // per organization instead of platform-wide. Remove it from the platform config
    // so it no longer implicitly enables the feature for every organization.
    platform.config.featureFlags = platform.config.featureFlags.filter(f => f !== 'uitpas');
    await platform.save();
    await Platform.clearCache();

    console.log('Removed the uitpas feature flag from the platform config');
});
