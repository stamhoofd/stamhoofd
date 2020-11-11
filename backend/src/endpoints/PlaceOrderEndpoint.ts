import { createMollieClient, PaymentMethod as molliePaymentMethod } from '@mollie/api-client';
import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { isSimpleError, isSimpleErrors, SimpleError } from '@simonbackx/simple-errors';
import { Order as OrderStruct, OrderData, OrderResponse, PaymentMethod, PaymentStatus, Version, Webshop as WebshopStruct } from "@stamhoofd/structures";

import { MolliePayment } from '../models/MolliePayment';
import { MollieToken } from '../models/MollieToken';
import { Order } from '../models/Order';
import { Organization } from '../models/Organization';
import { PayconiqPayment } from '../models/PayconiqPayment';
import { Payment } from '../models/Payment';
import { Webshop } from '../models/Webshop';
type Params = { id: string };
type Query = undefined;
type Body = OrderData
type ResponseBody = OrderResponse

const Base64 = (function () {

    const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

    const Base64 = function () {
        //
    };

    const _encode = function (value) {

        if (typeof(value) !== 'number') {
            throw 'Value is not number!';
        }

        let result = '', mod;
        do {
            mod = value % 64;
            result = ALPHA.charAt(mod) + result;
            value = Math.floor(value / 64);
        } while(value > 0);

        return result;
    };

    const _decode = function (value) {

        let result = 0;
        for (let i = 0, len = value.length; i < len; i++) {
            result *= 64;
            result += ALPHA.indexOf(value[i]);
        }

        return result;
    };

    Base64.prototype = {
        constructor: Base64,
        encode: _encode,
        decode: _decode
    };

    return Base64;

})();

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

        const validatedCart = request.body.cart
        try {
            validatedCart.validate(webshopStruct)
        } catch (e) {
            if (isSimpleError(e) || isSimpleErrors(e)) {
                e.addNamespace("cart")
            }
            throw e
        }

        const totalPrice = validatedCart.price

        const order = new Order().setRelation(Order.webshop, webshop)
        order.data = request.body // todo: validate
        order.organizationId = organization.id
        order.createdAt = new Date()
        order.createdAt.setMilliseconds(0)

        if (totalPrice == 0) {
            await order.markValid()
            await order.save()
        } else {
            const payment = new Payment()
            payment.method = request.body.paymentMethod
            payment.status = PaymentStatus.Created
            payment.price = totalPrice
            payment.transferDescription = payment.method == PaymentMethod.Transfer ? Payment.generateOGM() : null
            payment.paidAt = null

            if (totalPrice == 0) {
                payment.status = PaymentStatus.Succeeded
                payment.paidAt = new Date()
            }

            await payment.save()

            order.paymentId = payment.id
            order.setRelation(Order.payment, payment)
            if (payment.method == PaymentMethod.Transfer || payment.status == PaymentStatus.Succeeded) {
                await order.markValid()
            }

            await order.save()

            let paymentUrl: string | null = null
            const description = 'Betaling bij '+organization.name+" voor "+webshop.meta.name
            if (payment.status != PaymentStatus.Succeeded) {
                if (payment.method == PaymentMethod.Bancontact || payment.method == PaymentMethod.iDEAL) {
                    
                    // Mollie payment
                    const token = await MollieToken.getTokenFor(webshop.organizationId)
                    if (!token) {
                        throw new SimpleError({
                            code: "",
                            message: "Betaling via "+(payment.method == PaymentMethod.Bancontact ? "Bancontact" : "iDEAL") +" is onbeschikbaar"
                        })
                    }
                    const profileId = await token.getProfileId()
                    if (!profileId) {
                        throw new SimpleError({
                            code: "",
                            message: "Betaling via "+(payment.method == PaymentMethod.Bancontact ? "Bancontact" : "iDEAL") +" is tijdelijk onbeschikbaar"
                        })
                    }
                    const mollieClient = createMollieClient({ accessToken: await token.getAccessToken() });
                    const molliePayment = await mollieClient.payments.create({
                        amount: {
                            currency: 'EUR',
                            value: (totalPrice / 100).toFixed(2)
                        },
                        method: payment.method == PaymentMethod.Bancontact ? molliePaymentMethod.bancontact : molliePaymentMethod.ideal,
                        testmode: process.env.NODE_ENV != 'production',
                        profileId,
                        description,
                        redirectUrl: "https://"+webshop.getHost()+'/payment?id='+encodeURIComponent(payment.id),
                        webhookUrl: 'https://'+organization.getApiHost()+"/v"+Version+"/payments/"+encodeURIComponent(payment.id)+"?exchange=true",
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
                } else if (payment.method == PaymentMethod.Payconiq) {
                    paymentUrl = await PayconiqPayment.createPayment(payment, organization, description)
                }
            }

            return new Response(OrderResponse.create({
                paymentUrl: paymentUrl,
                order: OrderStruct.create(order)
            }));
        }
        
        return new Response(OrderResponse.create({
            order: OrderStruct.create(Object.assign({}, order, { payment: null }))
        }));
    }
}
