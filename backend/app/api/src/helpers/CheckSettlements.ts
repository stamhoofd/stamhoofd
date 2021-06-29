/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { MolliePayment, Payment } from '@stamhoofd/models';
import { Settlement } from '@stamhoofd/structures'
import axios from 'axios';

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

// Check settlements once a week on tuesday morning/night
export async function checkSettlements(checkAll = false) {
    if (!checkAll && lastSettlementCheck && (lastSettlementCheck > new Date(new Date().getTime() - 6 * 24 * 60 * 60 * 1000) || new Date().getDay() != 2)) {
        console.log("Skip settlement check")
        return
    }

    console.log("Checking settlements...")
    lastSettlementCheck = new Date()

    // Check last 2 weeks
    const d = new Date()
    d.setDate(d.getDate() - 14)

    // Loop all organizations with online paymetns the last week
    try {
        // Mollie payment is required
        const token = process.env.MOLLIE_ORGANIZATION_TOKEN
        if (!token) {
            throw new Error("Missing mollie organization token")
        }
        
        const request = await axios.get("https://api.mollie.com/v2/settlements", {
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
                    console.log(settlements)

                    for (const settlement of settlements) {
                        const settledAt = new Date(settlement.settledAt)
                        // Todo: only check settlements that are less than one week old

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

    // Loop mollie clients

    // Request all settlements

    // Update payments
}

async function updateSettlement(token: string, settlement: MollieSettlement) {
    // Loop all payments of this settlement
    const request = await axios.get("https://api.mollie.com/v2/settlements/"+settlement.id+"/payments?limit=250", {
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
                    await payment.save()
                    console.log("Updated settlement of payment "+payment.id)
                    console.log(payment.settlement)
                } else {
                    console.log("Missing payment "+mp.paymentId)
                }
            } else {
                console.log("No mollie payment found for id "+mollie.id)
            }
        }
    } else {
        console.error(request.data)
    }
}