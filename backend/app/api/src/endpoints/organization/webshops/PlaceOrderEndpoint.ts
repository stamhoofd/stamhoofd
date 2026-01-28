import { createMollieClient, PaymentMethod as molliePaymentMethod } from '@mollie/api-client';
import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { Email } from '@stamhoofd/email';
import { BalanceItem, BalanceItemPayment, MolliePayment, MollieToken, Order, PayconiqPayment, Payment, RateLimiter, Webshop, WebshopDiscountCode } from '@stamhoofd/models';
import { QueueHandler } from '@stamhoofd/queues';
import { AuditLogSource, BalanceItemRelation, BalanceItemRelationType, BalanceItemStatus, BalanceItemType, OrderData, OrderResponse, Order as OrderStruct, PaymentCustomer, PaymentMethod, PaymentMethodHelper, PaymentProvider, PaymentStatus, Payment as PaymentStruct, TranslatedString, Version, WebshopAuthType, Webshop as WebshopStruct, WebshopTicketType } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

import { BuckarooHelper } from '../../../helpers/BuckarooHelper.js';
import { Context } from '../../../helpers/Context.js';
import { StripeHelper } from '../../../helpers/StripeHelper.js';
import { AuditLogService } from '../../../services/AuditLogService.js';
import { UitpasService } from '../../../services/uitpas/UitpasService.js';
import { ServiceFeeHelper } from '../../../helpers/ServiceFeeHelper.js';
import { PaymentService } from '../../../services/PaymentService.js';

type Params = { id: string };
type Query = undefined;
type Body = OrderData;
type ResponseBody = OrderResponse;

export const demoOrderLimiter = new RateLimiter({
    limits: [
        {
            // Max 10 per hour
            limit: STAMHOOFD.environment === 'development' ? 100 : 10,
            duration: 60 * 1000 * 60,
        },
        {
            // Max 20 a day
            limit: STAMHOOFD.environment === 'development' ? 1000 : 20,
            duration: 24 * 60 * 1000 * 60,
        },
    ],
});

/**
 * Allow to add, patch and delete multiple members simultaneously, which is needed in order to sync relational data that is saved encrypted in multiple members (e.g. parents)
 */
export class PlaceOrderEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = OrderData as Decoder<OrderData>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'POST') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/webshop/@id/order', { id: String });

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOrganizationScope();
        await Context.optionalAuthenticate();

        // Read + validate + update stock in one go, to prevent race conditions
        const { webshop, order } = await QueueHandler.schedule('webshop-stock/' + request.params.id, async () => {
            const webshopWithoutOrganization = await Webshop.getByID(request.params.id);
            if (!webshopWithoutOrganization || webshopWithoutOrganization.organizationId !== organization.id) {
                throw new SimpleError({
                    code: 'not_found',
                    message: 'Webshop not found',
                    human: $t(`648708e0-b2f1-4336-979a-3ec3ca9cb8fd`),
                });
            }

            // const organization = (await Organization.getByID(webshopWithoutOrganization.organizationId))!
            const webshop = webshopWithoutOrganization.setRelation(Webshop.organization, organization);

            if (webshop.meta.authType === WebshopAuthType.Required && !Context.user) {
                throw new SimpleError({
                    code: 'not_authenticated',
                    message: 'Not authenticated',
                    human: $t(`2d5e0e5a-3fbe-4c75-ac6e-0fe8fb534716`),
                    statusCode: 401,
                });
            }

            // For non paid organizations, the limit is 10
            if (!organization.meta.packages.isPaid && STAMHOOFD.environment !== 'test') {
                const limiter = demoOrderLimiter;

                try {
                    limiter.track(organization.id, 1);
                }
                catch (e) {
                    Email.sendWebmaster({
                        subject: '[Limiet] Limiet bereikt voor aantal bestellingen',
                        text: 'Beste, \nDe limiet werd bereikt voor het aantal bestellingen per dag. \nVereniging: ' + organization.id + ' (' + organization.name + ')' + '\n\n' + e.message + '\n\nStamhoofd',
                    });

                    throw new SimpleError({
                        code: 'too_many_emails_period',
                        message: 'Too many e-mails limited',
                        human: $t(`a0e947ed-42d6-4cb8-98de-e38c27afc4db`),
                        field: 'recipients',
                    });
                }
            }

            const webshopStruct = WebshopStruct.create(webshop);

            const usedCodes = request.body.discountCodes.map(c => c.code);
            const uniqueCodes = Formatter.uniqueArray(usedCodes);
            if (uniqueCodes.length !== usedCodes.length) {
                // Duplicate code usage is not allowed
                throw new SimpleError({
                    code: 'duplicate_codes',
                    message: 'Duplicate usage of discount codes',
                    human: $t(`3de5ff97-4f7c-4eb3-8ead-21563ae8fbe1`),
                    field: 'cart.discountCodes',
                });
            }
            if (uniqueCodes.length > 0) {
                // Fetch new and update them
                const codeModels = await WebshopDiscountCode.getActiveCodes(webshop.id, uniqueCodes);

                if (codeModels.length !== uniqueCodes.length) {
                    throw new SimpleError({
                        code: 'invalid_code',
                        message: 'Invalid discount code',
                        human: $t(`c119c353-14ad-4a9e-958f-44189725f105`),
                        field: 'cart.discountCodes',
                    });
                }
                request.body.discountCodes = codeModels.map(c => c.getStructure());
            }

            request.body.validate(webshopStruct, organization.meta, request.i18n, false, Context.user?.getStructure());
            request.body.update(webshopStruct);

            request.body.cart = await UitpasService.validateCart(organization.id, webshop.id, request.body.cart);

            const order = new Order().setRelation(Order.webshop, webshop);
            order.data = request.body; // TODO: validate
            order.organizationId = organization.id;
            order.createdAt = new Date();
            order.createdAt.setMilliseconds(0);
            order.userId = Context.user?.id ?? null;

            // Always reserve the stock
            await AuditLogService.setContext({ source: AuditLogSource.System }, async () => {
                await order.updateStock(null, true);
            });

            await order.save();

            return { webshop, order, organization };
        });

        // The order now is valid, the stock is reserved for now (until the payment fails or expires)
        let totalPrice = request.body.totalPrice;

        if (totalPrice % 100 !== 0) {
            throw new SimpleError({
                code: 'more_than_2_decimal_places',
                message: 'Unexpected total price. The total price should be rounded to maximum 2 decimal places',
            });
        }

        try {
            if (totalPrice === 0) {
                // Force unknown payment method
                order.data.paymentMethod = PaymentMethod.Unknown;

                // Mark this order as paid
                await order.markPaid(null, organization, webshop);
                await order.save();
            }
            else {
                const payment = new Payment();
                payment.organizationId = organization.id;
                payment.method = request.body.paymentMethod;
                payment.status = PaymentStatus.Created;
                payment.price = totalPrice;
                PaymentService.round(payment);
                totalPrice = payment.price;
                payment.paidAt = null;
                payment.customer = PaymentCustomer.create({
                    firstName: request.body.customer.firstName,
                    lastName: request.body.customer.lastName,
                    email: request.body.customer.email,
                });

                // Determine the payment provider
                // Throws if invalid
                const { provider, stripeAccount } = await organization.getPaymentProviderFor(payment.method, webshop.privateMeta.paymentConfiguration);
                payment.provider = provider;
                payment.stripeAccountId = stripeAccount?.id ?? null;
                ServiceFeeHelper.setServiceFee(
                    payment,
                    organization,
                    webshop.meta.ticketType === WebshopTicketType.None ? 'webshop' : 'tickets',
                    order.data.cart.items.flatMap(i => i.calculatedPrices.map(p => p.discountedPrice)),
                );

                await payment.save();

                // Deprecated field
                order.paymentId = payment.id;
                order.setRelation(Order.payment, payment);

                // Save order to get the id
                await order.save();

                const balanceItemPayments: (BalanceItemPayment & { balanceItem: BalanceItem })[] = [];

                // Create balance item
                const balanceItem = new BalanceItem();
                balanceItem.type = BalanceItemType.Order;
                balanceItem.orderId = order.id;
                balanceItem.unitPrice = totalPrice;
                balanceItem.description = webshop.meta.name;
                balanceItem.pricePaid = 0;
                balanceItem.organizationId = organization.id;
                balanceItem.status = BalanceItemStatus.Hidden;
                balanceItem.relations = new Map([
                    [
                        BalanceItemRelationType.Webshop,
                        BalanceItemRelation.create({
                            id: webshop.id,
                            name: new TranslatedString(webshop.meta.name),
                        }),
                    ],
                ]);
                await balanceItem.save();

                // Create one balance item payment to pay it in one payment
                const balanceItemPayment = new BalanceItemPayment();
                balanceItemPayment.balanceItemId = balanceItem.id;
                balanceItemPayment.paymentId = payment.id;
                balanceItemPayment.organizationId = organization.id;
                balanceItemPayment.price = balanceItem.price;
                await balanceItemPayment.save();
                balanceItemPayments.push(balanceItemPayment.setRelation(BalanceItemPayment.balanceItem, balanceItem));

                let paymentUrl: string | null = null;
                let paymentQRCode: string | null = null;
                const description = webshop.meta.name + ' - ' + organization.name;

                if (payment.method === PaymentMethod.Transfer) {
                    await order.markValid(payment, []);

                    if (order.number) {
                        balanceItem.description = order.generateBalanceDescription(webshop);
                    }

                    balanceItem.status = BalanceItemStatus.Due;
                    await balanceItem.save();
                    await payment.save();
                }
                else if (payment.method === PaymentMethod.PointOfSale) {
                    // Not really paid, but needed to create the tickets if needed
                    await order.markPaid(payment, organization, webshop);

                    if (order.number) {
                        balanceItem.description = order.generateBalanceDescription(webshop);
                    }

                    balanceItem.status = BalanceItemStatus.Due;
                    await balanceItem.save();
                    await payment.save();
                }
                else {
                    const cancelUrl = 'https://' + webshop.getHost() + '/payment?id=' + encodeURIComponent(payment.id) + '&cancel=true';
                    const redirectUrl = 'https://' + webshop.getHost() + '/payment?id=' + encodeURIComponent(payment.id);
                    const exchangeUrl = 'https://' + organization.getApiHost() + '/v' + Version + '/payments/' + encodeURIComponent(payment.id) + '?exchange=true';

                    if (payment.provider === PaymentProvider.Stripe) {
                        const stripeResult = await StripeHelper.createPayment({
                            payment,
                            stripeAccount,
                            redirectUrl,
                            cancelUrl,
                            statementDescriptor: webshop.meta.name,
                            metadata: {
                                order: order.id,
                                organization: organization.id,
                                webshop: webshop.id,
                                payment: payment.id,
                            },
                            i18n: request.i18n,
                            lineItems: balanceItemPayments,
                            organization,
                            customer: {
                                name: order.data.customer.name,
                                email: order.data.customer.email,
                            },
                        });
                        paymentUrl = stripeResult.paymentUrl;
                    }
                    else if (payment.provider === PaymentProvider.Mollie) {
                        // Mollie payment
                        const token = await MollieToken.getTokenFor(webshop.organizationId);
                        if (!token) {
                            throw new SimpleError({
                                code: '',
                                message: $t(`b77e1f68-8928-42a2-802b-059fa73bedc3`, { method: PaymentMethodHelper.getName(payment.method) }),
                            });
                        }
                        const profileId = organization.privateMeta.mollieProfile?.id ?? await token.getProfileId(webshop.getHost());
                        if (!profileId) {
                            throw new SimpleError({
                                code: '',
                                message: $t(`5574469f-8eee-47fe-9fb6-1b097142ac75`, { method: PaymentMethodHelper.getName(payment.method) }),
                            });
                        }
                        const mollieClient = createMollieClient({ accessToken: await token.getAccessToken() });
                        const locale = Context.i18n.locale.replace('-', '_');
                        const molliePayment = await mollieClient.payments.create({
                            amount: {
                                currency: 'EUR',
                                value: (totalPrice / 10000).toFixed(2), // from 4 decimals to 0 decimals
                            },
                            method: payment.method == PaymentMethod.Bancontact ? molliePaymentMethod.bancontact : (payment.method == PaymentMethod.iDEAL ? molliePaymentMethod.ideal : molliePaymentMethod.creditcard),
                            testmode: organization.privateMeta.useTestPayments ?? STAMHOOFD.environment !== 'production',
                            profileId,
                            description,
                            redirectUrl,
                            webhookUrl: exchangeUrl,
                            metadata: {
                                order: order.id,
                                organization: organization.id,
                                webshop: webshop.id,
                                payment: payment.id,
                            },
                            locale: ['en_US', 'en_GB', 'nl_NL', 'nl_BE', 'fr_FR', 'fr_BE', 'de_DE', 'de_AT', 'de_CH', 'es_ES', 'ca_ES', 'pt_PT', 'it_IT', 'nb_NO', 'sv_SE', 'fi_FI', 'da_DK', 'is_IS', 'hu_HU', 'pl_PL', 'lv_LV', 'lt_LT'].includes(locale) ? (locale as any) : null,
                        });
                        console.log(molliePayment);
                        paymentUrl = molliePayment.getCheckoutUrl();

                        // Save payment
                        const dbPayment = new MolliePayment();
                        dbPayment.paymentId = payment.id;
                        dbPayment.mollieId = molliePayment.id;
                        await dbPayment.save();
                    }
                    else if (payment.provider == PaymentProvider.Payconiq) {
                        ({ paymentUrl, paymentQRCode } = await PayconiqPayment.createPayment(payment, organization, description, redirectUrl, exchangeUrl));
                    }
                    else if (payment.provider == PaymentProvider.Buckaroo) {
                        // Increase request timeout because buckaroo is super slow
                        request.request.request?.setTimeout(60 * 1000);
                        const buckaroo = new BuckarooHelper(organization.privateMeta?.buckarooSettings?.key ?? '', organization.privateMeta?.buckarooSettings?.secret ?? '', organization.privateMeta.useTestPayments ?? STAMHOOFD.environment !== 'production');
                        const ip = request.request.getIP();
                        paymentUrl = await buckaroo.createPayment(payment, ip, description, redirectUrl, exchangeUrl);
                        await payment.save();

                        // TypeScript doesn't understand that the status can change and isn't a const....
                        if ((payment.status as any) === PaymentStatus.Failed) {
                            throw new SimpleError({
                                code: 'payment_failed',
                                message: $t(`b77e1f68-8928-42a2-802b-059fa73bedc3`, {
                                    method: PaymentMethodHelper.getName(payment.method),
                                }),
                            });
                        }
                    }
                    else {
                        throw new Error('Unknown payment provider');
                    }
                }

                return new Response(OrderResponse.create({
                    paymentUrl: paymentUrl,
                    paymentQRCode,
                    order: OrderStruct.create({ ...order, payment: PaymentStruct.create(payment) }),
                }));
            }
        }
        catch (e) {
            // Mark order as failed to release stock
            if (order) {
                await order.deleteOrderBecauseOfCreationError();
            }
            throw e;
        }

        return new Response(OrderResponse.create({
            order: order.getStructureWithoutPayment(),
        }));
    }
}
