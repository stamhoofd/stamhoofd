import { registerCron } from '@stamhoofd/crons';
import { Organization, Platform } from '@stamhoofd/models';
import { Formatter } from '@stamhoofd/utility';
import { StripePayoutReporter } from '../helpers/StripePayoutReporter.js';

registerCron('stripe-payout-reports', createStripePayoutReports);

let lastStripeReport: Date | null = null;

/**
 * Sends a monthly report of all Stripe payouts of the previous month, so we can check
 * whether everything we charged via Stripe application fees was invoiced correctly.
 */
async function createStripePayoutReports() {
    if (STAMHOOFD.environment !== 'production') {
        return;
    }

    if (STAMHOOFD.userMode === 'platform') {
        return;
    }

    if (STAMHOOFD.STRIPE_CONNECT_METHOD === 'standard') {
        return;
    }

    if (new Date().getHours() > 5 || new Date().getHours() < 2) {
        // Fix for sending emails after deployments
        return;
    }

    // Send the report on the 6th day of the month, once
    const today = new Date();
    if (today.getDate() !== 6 || (lastStripeReport && Formatter.dateWithoutDay(lastStripeReport) === Formatter.dateWithoutDay(today))) {
        return;
    }

    if (!STAMHOOFD.STRIPE_SECRET_KEY) {
        console.log('No stripe key set');
        return;
    }

    const membershipOrganizationId = (await Platform.getShared()).membershipOrganizationId;
    if (!membershipOrganizationId) {
        return;
    }

    const membershipOrganization = await Organization.getByID(membershipOrganizationId, true);

    console.log('Creating Stripe payout report...');

    // Previous month
    const previousMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const end = new Date(new Date(today.getFullYear(), today.getMonth(), 1).getTime() - 1000);

    const reporter = new StripePayoutReporter({
        secretKey: STAMHOOFD.STRIPE_SECRET_KEY,
        sellingOrganization: membershipOrganization,
    });

    await reporter.build(previousMonthStart, end);
    await reporter.sendEmail({
        to: [{ email: 'simon@stamhoofd.be' }],
        // Only send the report to the extra (accounting) recipients when it is complete and valid
        extraRecipientsWhenValid: (STAMHOOFD.STRIPE_PAYOUT_REPORT_EMAILS ?? []).map(email => ({ email })),
    });

    lastStripeReport = new Date();
}
