import { RefundStatus } from '@mollie/api-client';
import { registerCron } from '@stamhoofd/crons';
import { MolliePayment, MollieToken, Organization, Payment } from '@stamhoofd/models';
import { PaymentStatus, PaymentType } from '@stamhoofd/structures';
import { MollieService } from '../services/MollieService.js';
import { PaymentService } from '../services/PaymentService.js';

registerCron('mollie-refunds', checkMollieRefunds);

/**
 * Refunds created before this date are ignored: those were created before
 * refund detection existed and have been handled manually.
 */
export const MOLLIE_REFUNDS_MINIMUM_DATE = new Date('2026-06-22T00:00:00.000Z');

let lastRun: Date | null = null;
export async function checkMollieRefunds() {
    if (STAMHOOFD.environment !== 'development') {
        if (lastRun && new Date().getTime() - lastRun.getTime() < 1000 * 60 * 60 * 12) {
            return;
        }
        lastRun = new Date();
    }
    await doCheckMollieRefunds(false);
}

export async function doCheckMollieRefunds(checkAll = false) {
    if (STAMHOOFD.environment !== 'development') {
        console.log('Checking Mollie refunds');
    }

    // Loop all mollie tokens
    for await (const token of MollieToken.select().limit(1).all({}, 'organizationId')) {
        const sellingOrganization = await Organization.getByID(token.id);
        if (sellingOrganization) {
            const service = await MollieService.create({ sellingOrganization });
            if (service) {
                await checkMollieRefundsFor(service, checkAll);
            }
        }
    }
}

export async function checkMollieRefundsFor(service: MollieService, checkAll = false) {
    if (STAMHOOFD.environment !== 'development') {
        console.log('Checking Mollie refunds for ' + service.sellingOrganization.name);
    }

    // Check last 7 days
    const offset = new Date(Date.now() - 1000 * 60 * 60 * 24 * 7);

    // due to a bug in mollie client code, testmode paramter is missing in the typescript definitions
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    for await (const refund of service.client.refunds.iterate({ sort: 'desc', testmode: service.testMode } as any)) {
        const createdAt = new Date(refund.createdAt);

        if (createdAt < MOLLIE_REFUNDS_MINIMUM_DATE) {
            break;
        }

        if (!checkAll && createdAt < offset) {
            break;
        }

        // Check if this refund is already registered (refunds created via the API are linked on
        // creation, so we cannot break here: an older refund created in the Mollie UI could still
        // be unhandled). Registered refunds that are still pending locally are reconciled: Mollie
        // refunds can still fail or be canceled until they are actually executed.
        const existingRefund = await MolliePayment.select().where('mollieId', refund.id).first(false);
        if (existingRefund) {
            await reconcileRefundStatus(existingRefund.paymentId, refund.status, createdAt);
            continue;
        }

        // Refunds that were canceled or failed before we ever registered them can be ignored
        if (refund.status === RefundStatus.canceled || refund.status === RefundStatus.failed) {
            continue;
        }

        // Safety net: when creating a refund via the API succeeded, but saving the link afterwards
        // failed, the local refund payment already exists. Restore the link instead of registering
        // the refund twice (the metadata is set in PaymentService.createRefund).
        const metadata = refund.metadata as { refundPaymentId?: string } | null;
        if (metadata?.refundPaymentId) {
            const localRefund = await Payment.getByID(metadata.refundPaymentId);
            if (localRefund && localRefund.type === PaymentType.Refund) {
                console.error('Restoring missing link for Mollie refund ' + refund.id + ' to payment ' + localRefund.id);
                const link = new MolliePayment();
                link.paymentId = localRefund.id;
                link.mollieId = refund.id;
                await link.save();

                await reconcileRefundStatus(localRefund.id, refund.status, createdAt);
                continue;
            }
        }

        if (refund.paymentId) {
            const molliePayment = await MolliePayment.select().where('mollieId', refund.paymentId).first(false);
            if (molliePayment) {
                const payment = await Payment.getByID(molliePayment.paymentId);
                if (payment) {
                    try {
                        const amount = Math.round(parseFloat(refund.amount.value) * 100) * 100;
                        const status = MollieService.refundStatusToPaymentStatus(refund.status) === PaymentStatus.Succeeded ? PaymentStatus.Succeeded : PaymentStatus.Pending;
                        const createdPayment = await PaymentService.registerRefund(payment, amount, createdAt, status);

                        // Link Mollie refund ID (so we don't register it twice and can set the settlement later)
                        const molliePayment = new MolliePayment();
                        molliePayment.paymentId = createdPayment.id;
                        molliePayment.mollieId = refund.id;
                        await molliePayment.save();
                    } catch (e) {
                        console.error('Failed to register refund ' + refund.id, e);
                    }
                }
            } else {
                console.error('Invalid refund payment id ' + refund.paymentId + ', not found');
            }
        }
    }

    if (STAMHOOFD.environment !== 'development') {
        console.log('Done checking Mollie refunds for ' + service.sellingOrganization.name);
    }
}

/**
 * Update a locally registered refund that is still pending when Mollie reports a final status
 * (refunded, failed or canceled).
 */
async function reconcileRefundStatus(paymentId: string, mollieStatus: RefundStatus, createdAt: Date) {
    const payment = await Payment.getByID(paymentId);
    if (!payment || !payment.organizationId) {
        return;
    }

    if (payment.status !== PaymentStatus.Pending && payment.status !== PaymentStatus.Created) {
        return;
    }

    const status = MollieService.refundStatusToPaymentStatus(mollieStatus);
    if (status === payment.status) {
        return;
    }

    const organization = await Organization.getByID(payment.organizationId);
    if (!organization) {
        return;
    }

    try {
        await PaymentService.handlePaymentStatusUpdate(payment, organization, status, createdAt);
    } catch (e) {
        console.error('Failed to reconcile refund status for payment ' + payment.id, e);
    }
}
