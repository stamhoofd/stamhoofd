import { Database, Migration } from '@simonbackx/simple-database';

export default new Migration(async () => {
    // A tenant charges its own fees until it is explicitly made a child of another one.
    await Database.update('UPDATE `platform` SET `feesTenantId` = `id` WHERE `feesTenantId` IS NULL');

    // Deployments run one platform row today, so both values come from the deployment environment.
    // If a second row ever exists here, the unique indexes turn this into a hard error rather than
    // silently giving two tenants the same host.
    await Database.update(
        'UPDATE `platform` SET `uri` = COALESCE(`uri`, ?), `domain` = COALESCE(`domain`, ?)',
        [STAMHOOFD.platformName, STAMHOOFD.domains.dashboard ?? null],
    );
});
