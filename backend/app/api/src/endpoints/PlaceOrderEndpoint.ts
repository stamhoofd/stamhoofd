import { createMollieClient, PaymentMethod as molliePaymentMethod } from '@mollie/api-client';
import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from '@simonbackx/simple-errors';
import { MolliePayment } from '@stamhoofd/models';
import { MollieToken } from '@stamhoofd/models';
import { Order } from '@stamhoofd/models';
import { Organization } from '@stamhoofd/models';
import { PayconiqPayment } from '@stamhoofd/models';
import { Payment } from '@stamhoofd/models';
import { Webshop } from '@stamhoofd/models';
import { QueueHandler } from '@stamhoofd/queues';
import { Order as OrderStruct, OrderData, OrderResponse, Payment as PaymentStruct, PaymentMethod, PaymentMethodHelper, PaymentProvider, PaymentStatus, Version, Webshop as WebshopStruct } from "@stamhoofd/structures";

import { BuckarooHelper } from '../helpers/BuckarooHelper';
type Params = { id: string };
type Query = undefined;
type Body = OrderData
type ResponseBody = OrderResponse

/**
 * Allow to add, patch and delete multiple members simultaneously, which is needed in order to sync relational data that is saved encrypted in multiple members (e.g. parents)
 */
export class PlaceOrderEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = OrderData as Decoder<OrderData>

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "POST") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/webshop/@id/order", { id: String });

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        // Read + validate + update stock in one go, to prevent race conditions
        const { webshop, order, organization } = await QueueHandler.schedule("webshop-stock/"+request.params.id, async () => {
            const webshopWithoutOrganization = await Webshop.getByID(request.params.id)
            if (!webshopWithoutOrganization) {
                throw new SimpleError({
                    code: "not_found",
                    message: "Webshop not found",
                    human: "Deze webshop bestaat niet (meer)"
                })
            }

            const organization = (await Organization.getByID(webshopWithoutOrganization.organizationId))!
            const webshop = webshopWithoutOrganization.setRelation(Webshop.organization, organization)
            const webshopStruct = WebshopStruct.create(webshop)

            request.body.validate(webshopStruct, organization.meta, request.i18n)
            

            const order = new Order().setRelation(Order.webshop, webshop)
            order.data = request.body // todo: validate
            order.organizationId = organization.id
            order.createdAt = new Date()
            order.createdAt.setMilliseconds(0)

            // Always reserve the stock
            await order.updateStock()
            return { webshop, order, organization }
        })

        // The order now is valid, the stock is reserved for now (until the payment fails or expires)
        const totalPrice = request.body.totalPrice

        if (totalPrice == 0) {
            // Force unknown payment method
            order.data.paymentMethod = PaymentMethod.Unknown

            // Mark this order as paid
            await order.markPaid(null, organization, webshop)
            await order.save()
        } else {
            const payment = new Payment()
            payment.organizationId = organization.id
            payment.method = request.body.paymentMethod
            payment.status = PaymentStatus.Created
            payment.price = totalPrice
            payment.paidAt = null

            // Determine the payment provider
            // Throws if invalid
            payment.provider = organization.getPaymentProviderFor(payment.method)

            await payment.save()

            order.paymentId = payment.id
            order.setRelation(Order.payment, payment)


            let paymentUrl: string | null = null
            const description = webshop.meta.name+" - "+payment.id

            if (payment.method == PaymentMethod.Transfer) {
                await order.markValid(payment, [])

                // Only now we can update the transfer description, since we need the order number as a reference
                payment.transferDescription = Payment.generateDescription(organization, webshop.meta.transferSettings, (order.number ?? "")+"")
                await payment.save()
                await order.save()
            } else if (payment.method == PaymentMethod.PointOfSale) {
                // Not really paid, but needed to create the tickets if needed
                await order.markPaid(payment, organization, webshop)
                await payment.save()
                await order.save()
            } else {
                // Save order, because we need the id
                await order.save()

                const redirectUrl = "https://"+webshop.getHost()+'/payment?id='+encodeURIComponent(payment.id)
                const exchangeUrl = 'https://'+organization.getApiHost()+"/v"+Version+"/payments/"+encodeURIComponent(payment.id)+"?exchange=true"

                
                if (payment.provider === PaymentProvider.Mollie) {
                    // Mollie payment
                    const token = await MollieToken.getTokenFor(webshop.organizationId)
                    if (!token) {
                        throw new SimpleError({
                            code: "",
                            message: "Betaling via " + PaymentMethodHelper.getName(payment.method) + " is onbeschikbaar"
                        })
                    }
                    const profileId = await token.getProfileId()
                    if (!profileId) {
                        throw new SimpleError({
                            code: "",
                            message: "Betaling via " + PaymentMethodHelper.getName(payment.method) + " is tijdelijk onbeschikbaar"
                        })
                    }
                    const mollieClient = createMollieClient({ accessToken: await token.getAccessToken() });
                    const molliePayment = await mollieClient.payments.create({
                        amount: {
                            currency: 'EUR',
                            value: (totalPrice / 100).toFixed(2)
                        },
                        method: payment.method == PaymentMethod.Bancontact ? molliePaymentMethod.bancontact : (payment.method == PaymentMethod.iDEAL ? molliePaymentMethod.ideal : molliePaymentMethod.creditcard),
                        testmode: organization.privateMeta.useTestPayments ?? STAMHOOFD.environment != 'production',
                        profileId,
                        description,
                        redirectUrl,
                        webhookUrl: exchangeUrl,
                        metadata: {
                            paymentId: payment.id,
                            orderId: order.id
                        },
                    });
                    console.log(molliePayment)
                    paymentUrl = molliePayment.getCheckoutUrl()

                    // Save payment
                    const dbPayment = new MolliePayment()
                    dbPayment.paymentId = payment.id
                    dbPayment.mollieId = molliePayment.id
                    await dbPayment.save();
                } else if (payment.provider == PaymentProvider.Payconiq) {
                    paymentUrl = await PayconiqPayment.createPayment(payment, organization, description)
                } else if (payment.provider == PaymentProvider.Buckaroo) {
                    // Increase request timeout because buckaroo is super slow
                    request.request.request?.setTimeout(60 * 1000)
                    const buckaroo = new BuckarooHelper(organization.privateMeta?.buckarooSettings?.key ?? "", organization.privateMeta?.buckarooSettings?.secret ?? "", organization.privateMeta.useTestPayments ?? STAMHOOFD.environment != 'production')
                    const ip = request.request.getIP()
                    paymentUrl = await buckaroo.createPayment(payment, ip, description, redirectUrl, exchangeUrl)
                    await payment.save()

                    // TypeScript doesn't understand that the status can change and isn't a const....
                    if ((payment.status as any) === PaymentStatus.Failed) {
                        throw new SimpleError({
                            code: "payment_failed",
                            message: "Betaling via " + PaymentMethodHelper.getName(payment.method) + " is onbeschikbaar"
                        })
                    }
                } else {
                    throw new Error("Unknown payment provider")
                }
            }

            return new Response(OrderResponse.create({
                paymentUrl: paymentUrl,
                order: OrderStruct.create({...order, payment: PaymentStruct.create(payment) })
            }));
        }
        
        return new Response(OrderResponse.create({
            order: OrderStruct.create(Object.assign({}, order, { payment: null }))
        }));
    }
}
