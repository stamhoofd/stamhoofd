import { createMollieClient } from '@mollie/api-client';
import { AutoEncoder, BooleanDecoder,Decoder,field } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from "@simonbackx/simple-errors";
import { OrderStatus, Payment as PaymentStruct,PaymentMethod,PaymentStatus } from "@stamhoofd/structures";

import { Member } from '../models/Member';
import { MolliePayment } from '../models/MolliePayment';
import { MollieToken } from '../models/MollieToken';
import { Order } from '../models/Order';
import { Organization } from '../models/Organization';
import { PayconiqPayment } from '../models/PayconiqPayment';
import { Payment } from '../models/Payment';
import { GetPaymentRegistrations } from './GetPaymentRegistrations';
type Params = {id: string};
class Query extends AutoEncoder {
    @field({ decoder: BooleanDecoder, optional: true })
    exchange = false
}
type Body = undefined
type ResponseBody = PaymentStruct | undefined;

/**
 * One endpoint to create, patch and delete groups. Usefull because on organization setup, we need to create multiple groups at once. Also, sometimes we need to link values and update multiple groups at once
 */

export class ExchangePaymentEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    queryDecoder = Query as Decoder<Query>

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "POST") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/payments/@id", {id: String});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        // Return registrations for old versions (this endpoint has been moved)
        // Not for exchange, since payment processing needs to happen still
        if (request.request.getVersion() < 19 && !request.query.exchange) {
            // todo: also process payments in frontend
            return new GetPaymentRegistrations().handle(request as any)
        }

        const organization = await Organization.fromApiHost(request.host);
        
        const payment = await Payment.getByID(request.params.id)
        if (!payment) {
            throw new SimpleError({
                code: "",
                message: "Deze link is ongeldig"
            })
        }

        // Not method on payment because circular references (not supprted in ts)
        await ExchangePaymentEndpoint.pollStatus(payment, organization)

        if (request.query.exchange) {
            return new Response(undefined);
        }
        
        return new Response( 
            PaymentStruct.create({
                id: payment.id,
                method: payment.method,
                status: payment.status,
                price: payment.price,
                transferDescription: payment.transferDescription,
                paidAt: payment.paidAt,
                createdAt: payment.createdAt,
                updatedAt: payment.updatedAt
            })
        );
    }

    static async pollStatus(payment: Payment, organization: Organization) {
        if (payment.status == PaymentStatus.Pending || payment.status == PaymentStatus.Created) {
            // if it has registrations
            const registrations = await Member.getRegistrationWithMembersForPayment(payment.id)

            // if it has orders
            const order = registrations.length > 0 ? undefined : await Order.getForPayment(organization, payment.id)
            
            if (payment.method == PaymentMethod.Bancontact || payment.method == PaymentMethod.iDEAL) {
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

                            if (order) {
                                await order.markValid()
                            }

                            await payment.save();
                        } else if (mollieData.status == "failed" || mollieData.status == "expired" || mollieData.status == "canceled") {
                            await order?.onPaymentFailed()
                            payment.status = PaymentStatus.Failed
                            await payment.save();
                        }
                    } else {
                        console.warn("Mollie payment is missing for organization "+organization.id+" while checking payment status...")
                    }
                }
            } else if (payment.method == PaymentMethod.Payconiq) {
                // Check status

                const payconiqPayments = await PayconiqPayment.where({ paymentId: payment.id}, { limit: 1 })
                if (payconiqPayments.length == 1) {
                    const payconiqPayment = payconiqPayments[0]

                    const status = await payconiqPayment.getStatus(organization)
                    payment.status = status

                    if (status == PaymentStatus.Succeeded) {
                        payment.status = PaymentStatus.Succeeded
                        payment.paidAt = new Date()

                        for (const registration of registrations) {
                            if (registration.registeredAt === null) {
                                registration.registeredAt = new Date()
                                await registration.save();
                            }
                        }

                        if (order) {
                            await order.markValid()
                        }

                        await payment.save();
                    } else if (status == PaymentStatus.Failed) {
                        await order?.onPaymentFailed()
                        payment.status = PaymentStatus.Failed
                        await payment.save();
                    } else {
                        await payment.save();
                    }
                } else {
                    console.warn("Payconiq payment is missing for organization "+organization.id+" while checking payment status...")
                }
            }
        }
    }
}
