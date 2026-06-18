import { Migration } from '@simonbackx/simple-database';
import { Platform } from '@stamhoofd/models';
import { RecordConfigurationFactory } from '@stamhoofd/structures';

export default new Migration(async () => {
    if (STAMHOOFD.environment === 'test') {
        console.log('skipped in tests');
        return;
    }

    // Only the platform itself (e.g. Stamhoofd) needs default personal data settings.
    // In organization mode the platform config is merged into every organization, which would
    // override their own settings, so we skip it there.
    if (STAMHOOFD.userMode !== 'platform') {
        console.log('skipped: only runs in platform mode');
        return;
    }

    const platform = await Platform.getForEditing();
    const config = platform.config.recordsConfiguration;
    const defaults = RecordConfigurationFactory.createPlatformDefault();

    // Only fill in fields that have not been configured yet, so we don't override manual changes.
    const fields = ['birthDay', 'gender', 'phone', 'emailAddress', 'address', 'parents', 'emergencyContacts'] as const;
    let changed = false;

    for (const field of fields) {
        if (config[field] === null && defaults[field] !== null) {
            config[field] = defaults[field];
            changed = true;
        }
    }

    if (!changed) {
        console.log('Platform records configuration already set, skipping');
        return;
    }

    await platform.save();
    console.log('Set default personal data settings on the platform');
});
