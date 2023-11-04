/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { MolliePayment, MollieToken, Order, Organization, PayconiqPayment, Payment, StripeAccount } from '@stamhoofd/models';
import { Settlement } from '@stamhoofd/structures'
import axios from 'axios';

import { StripePayoutChecker } from './StripePayoutChecker';

type MollieSettlement = {
    id: string;
    reference: string;
    createdAt: string;
    settledAt: string;
    status: "open" | "pending" | "paidout" | "failed";
    amount: {
        currenty: string;
        value: string;
    }
}

type MolliePaymentJSON = {
    id: string;
}

let lastSettlementCheck: Date | null = null

export async function checkAllStripePayouts(checkAll = false) {
    // Stripe payouts
    const stripeAccounts = await StripeAccount.all()
    for (const account of stripeAccounts) {
        try {
            console.log("Checking settlements for ", account.accountId)

            const checker = new StripePayoutChecker({
                secretKey: STAMHOOFD.STRIPE_SECRET_KEY,
                stripeAccount: account.accountId
            })
            await checker.checkSettlements(checkAll)
        } catch (e) {
            console.error(e)
        }
    }
}

export async function checkSettlements(checkAll = false) {
    if (!checkAll && lastSettlementCheck && (lastSettlementCheck > new Date(new Date().getTime() - 24 * 60 * 60 * 1000))) {
        console.log("Skip settlement check")
        return
    }

     if (STAMHOOFD.environment !== "production") {
        console.log("Skip settlement check")
        return
    }

    console.log("Checking settlements...")
    lastSettlementCheck = new Date()

    // Mollie payment is required
    const token = STAMHOOFD.MOLLIE_ORGANIZATION_TOKEN
    if (!token) {
        console.error("Missing mollie organization token")
    } else {
        await checkMollieSettlementsFor(token, checkAll)
    }

    // Loop all mollie tokens created after given date (when settlement permission was added)
    try {
        // Stripe payouts
        await checkAllStripePayouts(checkAll)

        const mollieTokens = await MollieToken.all()
        for (const token of mollieTokens) {
            if (token.createdAt < new Date(2021, 8 /* september! */, 8)) {
                console.log("Skipped mollie token that is too old")
            } else {
                try {
                    await token.refreshIfNeeded()
                    await checkMollieSettlementsFor(token.accessToken, checkAll)
                } catch (e) {
                    console.error(e)
                }
            }
        }
    } catch (e) {
        console.error(e)
    }
}

// Check settlements once a week on tuesday morning/night
export async function checkMollieSettlementsFor(token: string, checkAll = false) {
    // Check last 2 weeks + 3 day margin, unless we check them all
    const d = new Date()
    d.setDate(d.getDate() - 17)

    console.log("Checking settlements for given token...")

    // Loop all organizations with online paymetns the last week
    try {
        const request = await axios.get("https://api.mollie.com/v2/settlements?limit="+(checkAll ? 250 : 14), {
            headers: {
                "Authorization": "Bearer "+token
            }
        })
        if (request.status === 200) {
            // get data
            try {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                const data = request.data
                // Read the data
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                if (data._embedded?.settlements) {
                    const settlements = data._embedded.settlements as MollieSettlement[];

                    for (const settlement of settlements) {
                        if (settlement.settledAt === null) {
                            // Skip: this is the open settlement
                            continue;
                        }

                        const settledAt = new Date(settlement.settledAt)
                        
                        if (isNaN(settledAt.getTime())) {
                            console.error('Received an invalid settledAt from Mollie', settlement, 'for token', token);
                            continue;
                        }

                        if (checkAll || settledAt > d) {
                            await updateSettlement(token, settlement)
                        }
                    }
                } else {
                    console.error("Unreadable settlements")
                }
            } catch (e) {
                console.error(request.data)
                throw e;
            }
            
        } else {
            console.error("Failed to fetch settlements")
            console.error(request.data)
        }
        
    } catch (e) {
        console.error(e)
    }
}

async function updateSettlement(token: string, settlement: MollieSettlement, fromPaymentId?: string) {
    const limit = 250

    // Loop all payments of this settlement
    const request = await axios.get("https://api.mollie.com/v2/settlements/"+settlement.id+"/payments?limit="+limit+(fromPaymentId ? ("&from="+encodeURIComponent(fromPaymentId)) : ""), {
        headers: {
            "Authorization": "Bearer "+token
        }
    })

    if (request.status === 200) {
        const molliePayments = request.data._embedded.payments as MolliePaymentJSON[]

        for (const mollie of molliePayments) {
            // Search payment
            const mps = await MolliePayment.where({ mollieId: mollie.id })
            if (mps.length == 1) {
                const mp = mps[0]
                const payment = await Payment.getByID(mp.paymentId)
                if (payment) {
                    payment.settlement = Settlement.create({
                        id: settlement.id,
                        reference: settlement.reference,
                        settledAt: new Date(settlement.settledAt),
                        amount: Math.round(parseFloat(settlement.amount.value)*100)
                    })
                    const saved = await payment.save()

                    if (saved) {
                        // Mark order as 'updated', or the frontend won't pull in the updates
                        const order = await Order.getForPayment(null, payment.id)
                        if (order) {
                            order.updatedAt = new Date();
                            order.forceSaveProperty('updatedAt');
                            await order.save();
                        }

                        // TODO: Mark registrations as 'saved'
                    }
                    

                    if (STAMHOOFD.environment === "development") {
                        console.log("Updated settlement of payment "+payment.id)
                        console.log(payment.settlement)
                    }
                } else {
                    console.log("Missing payment "+mp.paymentId)
                }
            } else {
                console.log("No mollie payment found for id "+mollie.id)
            }
        }

        // Check next page
        if (request.data._links.next) {
            await updateSettlement(token, settlement, molliePayments[molliePayments.length - 1].id)
        }
    } else {
        console.error(request.data)
    }
}