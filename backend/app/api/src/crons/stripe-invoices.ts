import { registerCron } from '@stamhoofd/crons';
import { Formatter } from '@stamhoofd/utility';
import { StripeInvoicer } from '../helpers/StripeInvoicer.js';
import { Organization, Platform } from '@stamhoofd/models';

registerCron('stripe-invoices', createStripeInvoices);

let lastStripeInvoice: Date | null = null;

async function createStripeInvoices() {
    if (STAMHOOFD.environment !== 'production' && STAMHOOFD.environment !== 'development') {
        return;
    }

    if (STAMHOOFD.userMode === 'platform') {
        return;
    }

    if (STAMHOOFD.STRIPE_CONNECT_METHOD === 'standard') {
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

    const invoicer = new StripeInvoicer({
        secretKey: STAMHOOFD.STRIPE_SECRET_KEY,
    });
    await invoicer.generateAllInvoices(membershipOrganization, { forceLast: Formatter.dateIso(today) === '2026-07-03' });
    lastStripeInvoice = new Date();
}
