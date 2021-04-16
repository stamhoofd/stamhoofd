import { createMollieClient, PaymentMethod as molliePaymentMethod, SequenceType } from '@mollie/api-client';
import { ArrayDecoder, AutoEncoder, EnumDecoder, field } from "@simonbackx/simple-encoding";
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from "@simonbackx/simple-errors";
import { PaymentMethod, PaymentStatus, STInvoice as STInvoiceStruct,STInvoiceItem,STInvoiceResponse, STPackageBundle, STPackageBundleHelper, Version  } from "@stamhoofd/structures";

import { QueueHandler } from '../../helpers/QueueHandler';
import { MolliePayment } from '../../models/MolliePayment';
import { Payment } from "../../models/Payment";
import { STInvoice } from "../../models/STInvoice";
import { STPackage } from "../../models/STPackage";
import { STPendingInvoice } from '../../models/STPendingInvoice';
import { Token } from '../../models/Token';
type Params = {};
type Query = undefined;
type ResponseBody = STInvoiceResponse;

class Body extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(new EnumDecoder(STPackageBundle)) })
    bundles: STPackageBundle[]

    @field({ decoder: new EnumDecoder(PaymentMethod) })
    paymentMethod: PaymentMethod
}

export class ActivatePackagesEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "POST") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/billing/activate-packages", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const token = await Token.authenticate(request);
        const user = token.user

        // If the user has permission, we'll also search if he has access to the organization's key
        if (user.permissions === null || !user.permissions.hasFullAccess()) {
            throw new SimpleError({
                code: "permission_denied",
                message: "You don't have permissions for this endpoint",
                statusCode: 403
            })
        }

        return await QueueHandler.schedule("billing/invoices-"+user.organizationId, async () => {
            // Create packages
            const packages = request.body.bundles.map(bundle => STPackageBundleHelper.getCurrentPackage(bundle))

            const invoice = new STInvoice()
            invoice.organizationId = user.organizationId

            const date = new Date()
            
            // Save packages as models
            const models: STPackage[] = []
            for (const pack of packages) {
                const model = new STPackage()
                model.meta = pack.meta
                model.renewAt = pack.renewAt
                model.removeAt = pack.removeAt
                model.disableAt = pack.disableAt

                // Not yet valid / active (ignored until valid)
                model.validAt = null
                model.organizationId = user.organizationId

                // Add items to invoice
                for (const item of pack.meta.items) {
                    invoice.meta.items.push(
                        STInvoiceItem.fromPackageItem(item, pack, 0, date)
                    )
                }

                await model.save()
                models.push(model)
            }

            // Todo: apply credits

            // Determine VAT rate
            let VATRate = 0
            if (invoice.meta.companyAddress.country === "BE") {
                VATRate = 21
            } else {
                if (invoice.meta.companyVATNumber) {
                    VATRate = 0
                } else {
                    // Apply VAT rate of the home country for consumers in the EU

                    if (invoice.meta.companyAddress.country === "NL") {
                        VATRate = 21;
                    } else {
                        throw new SimpleError({
                            code: "country_not_supported",
                            message: "Non-business sales to your country are not yet supported. Please enter a valid VAT number.",
                        })
                    }
                }
            }
            invoice.meta.VATPercentage = VATRate

            // Calculate price
            let price = invoice.meta.priceWithVAT
            if (price > 0) {
                
                // Since we are about the pay something:
                // also add the items that are in the pending queue
                const pendingInvoice = await STPendingInvoice.getForOrganization(user.organizationId)
                if (pendingInvoice && pendingInvoice.invoiceId === null) {
                    // Already generate an ID for the invoice
                    await invoice.save()

                    pendingInvoice.invoiceId = invoice.id
                    await pendingInvoice.save()

                    // Add the items to our invoice
                    invoice.meta.items.push(...pendingInvoice.meta.items)
                }

                // Update price
                price = invoice.meta.priceWithVAT

                // Create payment
                const payment = new Payment()
                payment.organizationId = null
                payment.method = request.body.paymentMethod
                payment.status = PaymentStatus.Created
                payment.price = price
                payment.paidAt = null
                await payment.save()

                invoice.paymentId = payment.id
                invoice.setRelation(STInvoice.payment, payment)

                await invoice.save()

                const description = "Stamhoofd - "+invoice.id
                    
                // Mollie payment is required
                const apiKey = process.env.MOLLIE_API_KEY
                if (!apiKey) {
                    throw new SimpleError({
                        code: "",
                        message: "Betalingen zijn tijdelijk onbeschikbaar"
                    })
                }
                const mollieClient = createMollieClient({ apiKey });
                const molliePayment = await mollieClient.payments.create({
                    amount: {
                        currency: 'EUR',
                        value: (price / 100).toFixed(2)
                    },
                    method: payment.method == PaymentMethod.Bancontact ? molliePaymentMethod.bancontact : molliePaymentMethod.ideal,
                    testmode: process.env.NODE_ENV != 'production',
                    description,
                    customerId: "todo",
                    sequenceType: SequenceType.first,
                    redirectUrl: "https://"+process.env.HOSTNAME_DASHBOARD+'/billing/payment?id='+encodeURIComponent(payment.id),
                    webhookUrl: 'https://'+process.env.HOSTNAME_API+"/v"+Version+"/payments/"+encodeURIComponent(payment.id)+"?exchange=true",
                    metadata: {
                        invoiceId: invoice.id,
                        paymentId: payment.id,
                    }
                });
                console.log(molliePayment)
                const paymentUrl = molliePayment.getCheckoutUrl() ?? undefined

                // Save payment
                const dbPayment = new MolliePayment()
                dbPayment.paymentId = payment.id
                dbPayment.mollieId = molliePayment.id
                await dbPayment.save();

                return new Response(STInvoiceResponse.create({
                    paymentUrl: paymentUrl,
                    invoice: STInvoiceStruct.create(invoice)
                }));
            }

            // No need to create the invoice, since it was free

            // Validate all packages
            for (const model of models) {
                await model.activate()
            }

            return new Response(STInvoiceResponse.create({
                paymentUrl: undefined,
                invoice: undefined
            }));
        });
    }
}
