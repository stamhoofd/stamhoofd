import { MolliePayment, Payment, STInvoice } from '@stamhoofd/models';
import { PaymentMethod, PaymentProvider, PaymentStatus } from '@stamhoofd/structures';
import axios from 'axios';

let lastRun: Date | null = null
export async function checkMollieChargebacks() {
    if (lastRun && new Date().getTime() - lastRun.getTime() < 1000 * 60 * 60 * 24) {
        return
    }
    lastRun = new Date()
    await doCheckMollieChargebacks(false)
}

export async function doCheckMollieChargebacks(checkAll = false) {
    console.log("Checking Mollie chargebacks")

    // Mollie payment is required
    const token = STAMHOOFD.MOLLIE_ORGANIZATION_TOKEN as string|undefined
    if (!token) {
        console.error("Missing mollie organization token")
    } else {
        await checkMollieChargebacksFor(token, checkAll)
    }
}

type MollieChargeback = {
    id: string;
    paymentId: string;
    createdAt: string;
    amount: {
        currency: string;
        value: string;
    },
}

async function handleInvoiceChargeback(invoice: STInvoice, chargeback: MollieChargeback) {
    if (!invoice.paidAt || !invoice.paymentId) {
        console.error("Invalid invoice chargeback "+invoice.id)
        return;
    }
    const payment = await Payment.getByID(invoice.paymentId);
    if (!payment) {
        console.error("Payment not found for invoice "+invoice.id)
        return;
    }

    console.log("Handling chargeback for invoice "+invoice.id)

    // Create a new invoice for the chargeback and readd to outstanding balance
    await invoice.markFailed(payment, true)

    if (invoice.negativeInvoiceId) {
        // We created a negative invoice id for this chargeback
        const negativeInvoice = await STInvoice.getByID(invoice.negativeInvoiceId);
        if (!negativeInvoice) {
            console.error("Negative invoice not found for invoice "+invoice.id)
            return;
        }

        if (negativeInvoice.paymentId) {
            // Already linked a negative payment (chargeback)
            console.log("Negative payment already linked for invoice "+invoice.id)
            return;
        }

        console.log("Creating negative payment for invoice "+invoice.id)
        const price = -Math.round(parseFloat(chargeback.amount.value)*100)

        if (negativeInvoice.meta.totalPrice !== price) {
            throw new Error("Invalid price for negative invoice "+invoice.id + ", expected " + price + ", received " + negativeInvoice.meta.totalPrice)
        }

        const payment = new Payment();
        payment.price = price
        payment.paidAt = new Date(chargeback.createdAt);
        payment.method = PaymentMethod.Unknown
        payment.provider = PaymentProvider.Mollie
        payment.status = PaymentStatus.Succeeded
        await payment.save()

        // Link Mollie chargeback ID (so we can set settlement later in the settlements cron)
        const molliePayment = new MolliePayment();
        molliePayment.paymentId = payment.id
        molliePayment.mollieId = chargeback.id;

        await molliePayment.save()

        negativeInvoice.paymentId = payment.id;
        await negativeInvoice.save();
    }
}

export async function checkMollieChargebacksFor(token: string, checkAll = false) {
    console.log("Checking Mollie Chargebacks for given token...")

    let url: string|null = "https://api.mollie.com/v2/chargebacks?limit=100";

    if (STAMHOOFD.environment === 'development') {
        url = "https://api.mollie.com/v2/chargebacks?limit=100&testmode=true";
    }

    while (url) {
        try {
            const request = await axios.get(url, {
                headers: {
                    "Authorization": "Bearer "+token
                }
            })

            url = null;
            if (request.status === 200) {
                // get data
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                const data = request.data
                // Read the data
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                if (data._embedded?.chargebacks) {
                    const chargebacks = data._embedded.chargebacks as MollieChargeback[];

                    console.log('Received Mollie Chargebacks: ', chargebacks.length)

                    for (const chargeback of chargebacks) {
                        // todo
                        if (chargeback.paymentId) {
                            const molliePayment = await MolliePayment.where({mollieId: chargeback.paymentId});
                            if (molliePayment.length >= 1) {
                                const payment = await Payment.getByID(molliePayment[0].paymentId);
                                if (payment) {
                                    const invoices = await STInvoice.where({paymentId: payment.id});
                                    if (invoices.length === 1) {
                                        try {
                                            await handleInvoiceChargeback(invoices[0], chargeback)
                                        } catch (e) {
                                            console.error("Failed to handle chargeback for invoice "+invoices[0].id)
                                            console.error(e)
                                        }
                                    }
                                }
                            } else {
                                console.error("Invalid chargeback payment id "+chargeback.paymentId + ', not found')
                            }
                        }
                    }
                } else {
                    console.error("Unreadable settlements")
                }

            
                if (request.data._links?.next?.href && checkAll) {
                    if (request.data._links.next.href === url) {
                        console.error("Infinite loop detected")
                        break;
                    }
                    url = request.data._links.next.href;
                }
            } else {
                console.error("Failed to fetch settlements")
                console.error(request.data)
            }
            
        } catch (e) {
            console.error(e)
        }
    }
}