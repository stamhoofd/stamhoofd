import { Migration } from '@node/database';
import { Group, RegistrationPeriod } from '@stamhoofd/models';
import { SeedTools } from '../helpers/SeedTools.js';

/**
 * Fills the cached period of groups that don't have one yet. The original migration (1752848565) only ran for the Stamhoofd platform.
 */
export async function fillGroupCachedPeriods() {
    const periods = new Map<string, RegistrationPeriod | null>();

    await SeedTools.loop({
        query: Group.select(),
        batchSize: 100,
        action: async (group: Group) => {
            if (group.settings.period) {
                return;
            }

            if (!periods.has(group.periodId)) {
                periods.set(group.periodId, await RegistrationPeriod.getByID(group.periodId) ?? null);
            }
            const period = periods.get(group.periodId);
            if (!period) {
                console.error(`No period found for group ${group.id} (periodId: ${group.periodId})`);
                return;
            }

            group.settings.period = period.getBaseStructure();
            await group.save();
        },
    });
}

export default new Migration(async () => {
    if (STAMHOOFD.environment === 'test') {
        console.log('skipped in tests');
        return;
    }

    await fillGroupCachedPeriods();
});
