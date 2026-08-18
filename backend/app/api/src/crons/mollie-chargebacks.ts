import { registerCron } from '@stamhoofd/crons';
import { MolliePayment, MollieToken, Organization, Payment } from '@stamhoofd/models';
import { MollieService } from '../services/MollieService.js';
import { PaymentService } from '../services/PaymentService.js';

registerCron('mollie-chargebacks', checkMollieChargebacks);

let lastRun: Date | null = null;
export async function checkMollieChargebacks() {
    if (STAMHOOFD.environment !== 'development') {
        if (lastRun && new Date().getTime() - lastRun.getTime() < 1000 * 60 * 60 * 24) {
            return;
        }
        lastRun = new Date();
    }
    await doCheckMollieChargebacks(false);
}

export async function doCheckMollieChargebacks(checkAll = false) {
    if (STAMHOOFD.environment !== 'development') {
        console.log('Checking Mollie chargebacks');
    }

    // Loop all mollie tokens
    for await (const token of MollieToken.select().limit(1).all({}, 'organizationId')) {
        // todo
        const sellingOrganization = await Organization.getByID(token.id);
        if (sellingOrganization) {
            const service = await MollieService.create({ sellingOrganization });
            if (service) {
                await checkMollieChargebacksFor(service, checkAll);
            }
        }
    }
}

export async function checkMollieChargebacksFor(service: MollieService, checkAll = false) {
    if (STAMHOOFD.environment !== 'development') {
        console.log('Checking Mollie chargebacks for ' + service.sellingOrganization.name);
    }

    // Check last 3 days
    const offset = new Date(Date.now() - 1000 * 60 * 60 * 24 * 4);

    const pages = await service.client.chargebacks.all({ sort: 'desc', limit: 250 });

    pagesLoop: for await (const page of pages) {
        for (const chargeback of page.result.embedded.chargebacks) {
            if (!checkAll && new Date(chargeback.createdAt) < offset) {
                break pagesLoop;
            }

            // Check if this chargeback has been handled
            const existingChargeback = await MolliePayment.select().where('mollieId', chargeback.id).first(false);
            if (existingChargeback) {
                // We can break because all older chargebacks will also be handled
                break pagesLoop;
            }

            if (chargeback.paymentId) {
                const molliePayment = await MolliePayment.select().where('mollieId', chargeback.paymentId).first(false);
                if (molliePayment) {
                    const payment = await Payment.getByID(molliePayment.paymentId);
                    if (payment) {
                        try {
                            const amount = Math.round(parseFloat(chargeback.amount.value) * 100) * 100;
                            const createdPayment = await PaymentService.registerChargeback(payment, amount, new Date(chargeback.createdAt));

                            // Link Mollie chargeback ID (so we can set settlement later in the settlements cron)
                            const molliePayment = new MolliePayment();
                            molliePayment.paymentId = createdPayment.id;
                            molliePayment.mollieId = chargeback.id;
                            await molliePayment.save();
                        } catch (e) {
                            console.error('Failed to register chargeback ' + chargeback.id, e);
                        }
                    }
                } else {
                    console.error('Invalid chargeback payment id ' + chargeback.paymentId + ', not found');
                }
            }
        }
    }

    if (STAMHOOFD.environment !== 'development') {
        console.log('Done checking Mollie chargebacks for ' + service.sellingOrganization.name);
    }
}
