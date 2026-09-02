import { Organization, Platform } from '@stamhoofd/models';
import { Formatter } from '@stamhoofd/utility';
import { registerRootTenantCron } from './helpers/registerTenantCron.js';

import { ApplicationFeeInvoicer } from '../helpers/ApplicationFeeInvoicer.js';

registerRootTenantCron('stripe-invoices', createStripeInvoices);

let lastStripeInvoice: Date | null = null;

/**
 * Whether application fees are billed automatically. The sync stores what we received either way,
 * so anything that reports on uninvoiced fees has to ask this first: while it is off, fees staying
 * uninvoiced is the expected state, not a problem.
 *
 * The settlements feature is not released yet: allow production at go-live.
 */
export function isApplicationFeeInvoicingEnabled(): boolean {
    return STAMHOOFD.userMode !== 'platform'
        && STAMHOOFD.STRIPE_CONNECT_METHOD !== 'standard';
}

async function createStripeInvoices() {
    if (!isApplicationFeeInvoicingEnabled()) {
        return;
    }

    // Wait for the next day before doing a new check
    const today = new Date();
    if (lastStripeInvoice && Formatter.dateIso(lastStripeInvoice) === Formatter.dateIso(today)) {
        console.log('Stripe check done for this day');
        return;
    }

    console.log('Creating Stripe Invoices...');

    if (!STAMHOOFD.STRIPE_SECRET_KEY) {
        console.log('No stripe key set');
        return;
    }

    const membershipOrganizationId = (await Platform.getShared()).membershipOrganizationId;
    if (!membershipOrganizationId) {
        return;
    }

    const membershipOrganization = await Organization.getByID(membershipOrganizationId, true);

    const invoicer = new ApplicationFeeInvoicer({
        secretKey: STAMHOOFD.STRIPE_SECRET_KEY,
    });
    await invoicer.generateInvoices(membershipOrganization);
    lastStripeInvoice = new Date();
}
