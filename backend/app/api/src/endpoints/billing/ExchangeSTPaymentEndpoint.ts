import { createMollieClient } from '@mollie/api-client';
import { AutoEncoder, BooleanDecoder,Decoder,field } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from "@simonbackx/simple-errors";
import { PaymentMethod,PaymentStatus, STInvoice as STInvoiceStruct } from "@stamhoofd/structures";

import { QueueHandler } from '@stamhoofd/queues';
import { MolliePayment } from "@stamhoofd/models";
import { Payment } from "@stamhoofd/models";
import { STInvoice } from "@stamhoofd/models";
type Params = {id: string};
class Query extends AutoEncoder {
    @field({ decoder: BooleanDecoder, optional: true })
    exchange = false
}
type Body = undefined
type ResponseBody = STInvoiceStruct | undefined;

/**
 * One endpoint to create, patch and delete groups. Usefull because on organization setup, we need to create multiple groups at once. Also, sometimes we need to link values and update multiple groups at once
 */

export class ExchangeSTPaymentEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    queryDecoder = Query as Decoder<Query>

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "POST") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/billing/payments/@id", {id: String});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {        
        const payment = await Payment.getByID(request.params.id)
        if (!payment) {
            throw new SimpleError({
                code: "",
                message: "Deze link is ongeldig"
            })
        }

        const invoices = await STInvoice.where({ paymentId: payment.id })
        if (invoices.length > 1) {
            console.error("Received more than 1 invoices for the same payment. Danger zone!")
            throw new Error("Unexpected error")
        }

        if (invoices.length == 0) {
            console.error("Didn't found and invoice for a given payment!")
            throw new Error("Unexpected error")
        }

        // Not method on payment because circular references (not supprted in ts)
        const invoice = invoices[0]

        if (request.query.exchange) {
            // Don't wait for exchanges
            ExchangeSTPaymentEndpoint.pollStatus(payment, invoice).catch(e => {
                console.error(e)
            })
            return new Response(undefined);
        }
        
        const updatedInvoice = await ExchangeSTPaymentEndpoint.pollStatus(payment, invoice)

        if (!updatedInvoice) {
            return new Response(undefined);
        }
        
        return new Response( 
            await updatedInvoice.getStructure()
        );
    }

    static async pollStatus(payment: Payment, _invoice: STInvoice): Promise<STInvoice | undefined> {
        // All invoice related logic needs to happen after each ather, not concurrently
        return await QueueHandler.schedule("billing/invoices-"+_invoice.organizationId, async () => {

            // Get a new copy of the invoice (is required to prevent concurrenty bugs)
            const invoice = await STInvoice.getByID(_invoice.id)
            if (!invoice || invoice.paidAt !== null) {
                return invoice
            }

            if (payment.status == PaymentStatus.Pending || payment.status == PaymentStatus.Created) {    

                if (payment.method == PaymentMethod.Bancontact || payment.method == PaymentMethod.iDEAL) {
                    // check status via mollie
                    const molliePayments = await MolliePayment.where({ paymentId: payment.id}, { limit: 1 })
                    if (molliePayments.length == 1) {
                        const molliePayment = molliePayments[0]
                        // check status
                        const apiKey = process.env.MOLLIE_API_KEY
                        if (apiKey) {
                            const mollieClient = createMollieClient({ apiKey });
                            const mollieData = await mollieClient.payments.get(molliePayment.mollieId)

                            console.log(mollieData) // log to log files to check issues

                            if (mollieData.status == "paid") {
                                payment.status = PaymentStatus.Succeeded
                                payment.paidAt = new Date()
                                await invoice.markPaid()

                                await payment.save();
                            } else if (mollieData.status == "failed" || mollieData.status == "expired" || mollieData.status == "canceled") {
                                await invoice.markFailed()
                                payment.status = PaymentStatus.Failed
                                await payment.save();
                            }
                        } else {
                            console.error("Mollie api key is missing for Stamhoofd payments! "+payment.id)
                        }
                    } else {
                        console.error("Couldn't find mollie payment for payment "+payment.id)
                    }
                } else {
                    console.error("Payment method not supported for invoice "+invoice.id+" and payment "+payment.id)
                    throw new Error("Unsupported payment method for invoices")
                }
            }
            return invoice
        });
    }
}
