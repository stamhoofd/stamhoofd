import { createMollieClient } from '@mollie/api-client';
import { Migration } from '@simonbackx/simple-database';
import { PaymentMethod, PaymentStatus } from '@stamhoofd/structures';

import { Member } from '../models/Member';
import { MolliePayment } from '../models/MolliePayment';
import { MollieToken } from '../models/MollieToken';
import { Organization } from '../models/Organization';
import { Payment } from '../models/Payment';

export default new Migration(async () => {
        const payments = await Payment.where({ status: "Created", method: "Bancontact" })

        for (const payment of payments) {
            try {
                const registrations = await Member.getRegistrationWithMembersForPayment(payment.id)
                if (registrations.length == 0) {
                    console.log("Could not restore payment: "+payment.id+": registrations missing")
                    continue;
                }
                const organizationId = registrations[0].member.organizationId
                const organization = (await Organization.getByID(organizationId))!

                if ((payment.status == PaymentStatus.Pending || payment.status == PaymentStatus.Created ) && (payment.method == PaymentMethod.Bancontact || payment.method == PaymentMethod.iDEAL)) {
                    // check status via mollie
                    const molliePayments = await MolliePayment.where({ paymentId: payment.id}, { limit: 1 })
                    if (molliePayments.length == 1) {
                        const molliePayment = molliePayments[0]
                        // check status
                        const token = await MollieToken.getTokenFor(organization.id)
                        
                        if (token) {
                            const mollieClient = createMollieClient({ accessToken: await token.getAccessToken() });
                            const mollieData = await mollieClient.payments.get(molliePayment.mollieId, {
                                testmode: process.env.NODE_ENV != 'production',
                            })

                            console.log(mollieData) // log to log files to check issues

                            if (mollieData.status == "paid") {
                                payment.status = PaymentStatus.Succeeded
                                payment.paidAt = new Date()

                                for (const registration of registrations) {
                                    if (registration.registeredAt === null) {
                                        registration.registeredAt = new Date()
                                        await registration.save();
                                    }
                                }

                                await payment.save();
                            } else if (mollieData.status == "failed" || mollieData.status == "expired" || mollieData.status == "canceled") {
                                payment.status = PaymentStatus.Failed
                                await payment.save();
                            }
                        } else {
                            console.warn("Mollie payment is missing for organization "+organization.id+" while checking payment status...")
                        }
                    }
                }
            } catch (e) {
                console.log("Could not restore payment: "+payment.id+", error:")
                console.error(e)
            }
        }
});


