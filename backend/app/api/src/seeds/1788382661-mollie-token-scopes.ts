import { Migration } from '@simonbackx/simple-database';
import { MollieToken, Organization } from '@stamhoofd/models';

import { SeedTools } from '../helpers/SeedTools.js';

/**
 * The OAuth scope the dashboard requested for every Mollie connection before scopes were stored.
 */
const LEGACY_SCOPES = [
    'payments.read',
    'payments.write',
    'refunds.read',
    'refunds.write',
    'organizations.read',
    'organizations.write',
    'onboarding.read',
    'onboarding.write',
    'profiles.read',
    'profiles.write',
    'subscriptions.read',
    'subscriptions.write',
    'mandates.read',
    'mandates.write',
    'settlements.read',
    'orders.read',
    'orders.write',
    'customers.read',
    'customers.write',
    'webhooks.read',
    'webhooks.write',
];

export default new Migration(async () => {
    if (STAMHOOFD.environment === 'test') {
        console.log('skipped in tests');
        return;
    }

    await SeedTools.loop({
        query: MollieToken.select(),
        batchSize: 100,
        action: async (token) => {
            if (token.scopes !== null) {
                return;
            }
            token.scopes = LEGACY_SCOPES;
            await token.save();

            // The stored onboarding status only refreshes when Mollie is checked: fill in the
            // missing scopes now so the reconnect warning shows without a check
            const organization = await Organization.getByID(token.organizationId);
            if (organization?.privateMeta.mollieOnboarding) {
                organization.privateMeta.mollieOnboarding.missingScopes = token.missingScopes;
                await organization.save();
            }
        },
    });
});
