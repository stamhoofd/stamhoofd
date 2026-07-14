import { Migration } from '@simonbackx/simple-database';
import { BalanceItem, Organization, Registration } from '@stamhoofd/models';
import { QueryableModel } from '@stamhoofd/sql';
import { BalanceItemStatus } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { SeedTools } from '../helpers/SeedTools.js';
import { BalanceItemService } from '../services/BalanceItemService.js';

/**
 * Registrations with a trial period that were made via the member portal were never activated: their
 * balance items are only due after the trial, so they were not part of the payment, and nothing ever
 * marked them valid. The result is a registration that exists in the database, but is invisible in the
 * registration lists and the member portal, and a balance item that stays Hidden and is never billed.
 *
 * markPaid (without a payment) puts them in the exact same state as a registration made after the fix:
 * it marks the balance item due (Hidden -> Due) and marks the registration valid without shortening the
 * trial period.
 */
export async function fixInvisibleTrialRegistrations() {
    let fixed = 0;
    let skipped = 0;

    const result = await SeedTools.loopBatched({
        // Keyset pagination on id: activating a registration drops it from this filter, but rows are
        // never skipped because each next batch is fetched by id > lastId.
        query: Registration.select()
            .whereNot('trialUntil', null)
            .where('registeredAt', null)
            .where('deactivatedAt', null),
        batchSize: 100,
        batchAction: async (registrations: Registration[]) => {
            const organizationIds = Formatter.uniqueArray(registrations.map(r => r.organizationId));
            const organizations = organizationIds.length ? await Organization.getByIDs(...organizationIds) : [];

            for (const registration of registrations) {
                try {
                    const organization = organizations.find(o => o.id === registration.organizationId);
                    if (!organization) {
                        console.warn('Organization not found for registration, skipping', registration.id, registration.organizationId);
                        skipped++;
                        continue;
                    }

                    // The registration was invisible, so the member may have been registered for the same
                    // group again in the meantime. Activating this one would create a duplicate.
                    const activeDuplicates = await Registration.select()
                        .where('memberId', registration.memberId)
                        .where('groupId', registration.groupId)
                        .where('periodId', registration.periodId)
                        .whereNot('registeredAt', null)
                        .where('deactivatedAt', null)
                        .count();

                    if (activeDuplicates > 0) {
                        console.log('Member is already registered for this group again, skipping', registration.id);
                        skipped++;
                        continue;
                    }

                    // Do not send a registration confirmation email for a registration that was made a
                    // long time ago. The flag is only read when the registration is marked valid.
                    if (registration.sendConfirmationEmail) {
                        registration.sendConfirmationEmail = false;
                        await registration.save();
                    }

                    // All the balance items of a trial registration are deferred (Hidden + dueAt), so they
                    // all need to be marked due. The base and option items also mark the registration valid.
                    const balanceItems = await BalanceItem.select()
                        .where('registrationId', registration.id)
                        .where('status', BalanceItemStatus.Hidden)
                        .fetch();

                    for (const balanceItem of balanceItems) {
                        await BalanceItemService.markPaid(balanceItem, null, organization);
                    }

                    // A trial registration always has at least one balance item, but don't leave the
                    // registration invisible if it somehow doesn't.
                    await registration.refresh();
                    if (registration.registeredAt === null) {
                        console.warn('Registration has no hidden balance items to activate it, skipping', registration.id);
                        skipped++;
                        continue;
                    }

                    fixed++;
                } catch (e) {
                    // Isolate failures per registration: one bad row should not abort (and wedge) the whole migration.
                    console.error('Failed to fix trial registration, skipping', registration.id, e);
                    skipped++;
                }

                if (QueryableModel.shutdownMigrations) {
                    break;
                }
            }

            if (QueryableModel.shutdownMigrations) {
                throw new Error('Stopping migration gracefully');
            }
        },
    });

    console.log(`Finished fixing invisible trial registrations: ${fixed} fixed, ${skipped} skipped of ${result.total} registrations.`);

    return { fixed, skipped };
}

export default new Migration(async () => {
    if (STAMHOOFD.environment === 'test') {
        console.log('skipped in tests');
        return;
    }

    console.log('Start fixing invisible trial registrations.');
    await fixInvisibleTrialRegistrations();
});
