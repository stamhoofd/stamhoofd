import { Migration } from '@simonbackx/simple-database';
import { logger } from '@simonbackx/simple-logging';
import { DocumentTemplate } from '@stamhoofd/models';
import { SeedTools } from '../helpers/SeedTools.js';

/**
 * Fiscal certificates with a severe disability only cover the days before the 21st birthday,
 * the same way the regular limit of 13 covers the days before the 14th birthday. Existing
 * templates were seeded with 21, which also certified the year the member was 21.
 */
export function correctSevereDisabilityMaxAge(template: DocumentTemplate): boolean {
    if (template.privateSettings.templateDefinition.type !== 'fiscal' || template.settings.maxAgeSevereDisability !== 21) {
        return false;
    }

    template.settings.maxAgeSevereDisability = 20;
    return true;
}

export default new Migration(async () => {
    if (STAMHOOFD.environment === 'test') {
        console.log('skipped in tests');
        return;
    }

    let updated = 0;

    const result = await logger.setContext({ tags: ['silent-seed', 'seed'] }, async () => {
        return await SeedTools.loop({
            query: DocumentTemplate.select(),
            batchSize: 100,
            action: async (template) => {
                if (!correctSevereDisabilityMaxAge(template)) {
                    return;
                }

                await template.save({
                    forceSave: true,
                    skipMarkSaved: true,
                    skipSendEvents: true,
                });
                updated++;
            },
        });
    });

    console.log('Corrected the severe disability age limit of ' + updated + ' of ' + result.total + ' document templates');
});
