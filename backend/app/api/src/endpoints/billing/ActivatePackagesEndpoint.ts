import { createMollieClient, PaymentMethod as molliePaymentMethod, SequenceType } from '@mollie/api-client';
import { ArrayDecoder, AutoEncoder, BooleanDecoder, Decoder, EnumDecoder, field, StringDecoder } from "@simonbackx/simple-encoding";
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from "@simonbackx/simple-errors";
import { MolliePayment } from "@stamhoofd/models";
import { Payment } from "@stamhoofd/models";
import { Registration } from "@stamhoofd/models";
import { STInvoice } from "@stamhoofd/models";
import { STPackage } from "@stamhoofd/models";
import { STPendingInvoice } from "@stamhoofd/models";
import { Token } from "@stamhoofd/models";
import { QueueHandler } from '@stamhoofd/queues';
import { calculateVATPercentage,PaymentMethod, PaymentStatus, STInvoiceItem,STInvoiceMeta,STInvoiceResponse, STPackage as STPackageStruct,STPackageBundle, STPackageBundleHelper, STPricingType, Version  } from "@stamhoofd/structures";
type Params = Record<string, never>;
type Query = undefined;
type ResponseBody = STInvoiceResponse;

class Body extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(new EnumDecoder(STPackageBundle)), optional: true })
    bundles: STPackageBundle[] = []

    @field({ decoder: new ArrayDecoder(StringDecoder), optional: true })
    renewPackageIds: string[] = []

    @field({ decoder: new EnumDecoder(PaymentMethod) })
    paymentMethod: PaymentMethod

    @field({ decoder: BooleanDecoder, optional: true })
    proForma = false
}

export class ActivatePackagesEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = Body as Decoder<Body>

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

            const invoice = STInvoice.createFor(user.organization)
            const date = invoice.meta.date!

            let membersCount: number | null = null
            
            // Save packages as models
            const models: STPackage[] = []
            for (const pack of packages) {
                const model = new STPackage()
                model.id = pack.id
                model.meta = pack.meta
                model.validUntil = pack.validUntil
                model.removeAt = pack.removeAt

                // Not yet valid / active (ignored until valid)
                model.validAt = null
                model.organizationId = user.organizationId

                // If type is 
                let amount = 1

                if (membersCount === null && pack.meta.pricingType === STPricingType.PerMember) {
                    membersCount = await Registration.getActiveMembers(user.organizationId)
                }

                if (pack.meta.pricingType === STPricingType.PerMember) {
                    amount = membersCount ?? 1
                }

                // Add items to invoice
                invoice.meta.items.push(
                    STInvoiceItem.fromPackage(pack, amount, 0, date)
                )

                if (!request.body.proForma) {
                    await model.save()
                }
                models.push(model)
            }

            // Add renewals
            if (request.body.renewPackageIds.length > 0) {
                const currentPackages = await STPackage.getForOrganization(user.organizationId)

                for (const id of request.body.renewPackageIds) {
                    const pack = currentPackages.find(c => c.id === id)
                    if (!pack) {
                        throw new SimpleError({
                            code: "not_found",
                            message: "Package not found",
                            human: "Het pakket dat je wil verlengen kan je helaas niet meer verlengen"
                        })
                    }

                    // Renew
                    const model = pack.createRenewed()

                    // If type is 
                    let amount = 1

                    if (membersCount === null && pack.meta.pricingType === STPricingType.PerMember) {
                        membersCount = await Registration.getActiveMembers(user.organizationId)
                    }

                    if (pack.meta.pricingType === STPricingType.PerMember) {
                        amount = membersCount ?? 1
                    }

                    // Add items to invoice
                    invoice.meta.items.push(
                        STInvoiceItem.fromPackage(STPackageStruct.create(model), amount, 0, date)
                    )

                    if (!request.body.proForma) {
                        await model.save()
                    }
                    models.push(model)
                }
            }

            // Todo: apply credits

            // Calculate price
            let price = invoice.meta.priceWithVAT
            if (price > 0) {
                
                // Since we are about the pay something:
                // also add the items that are in the pending queue
                const pendingInvoice = await STPendingInvoice.addItems(user.organization)
                if (pendingInvoice && pendingInvoice.invoiceId === null) {
                    if (!request.body.proForma) {
                        // Already generate an ID for the invoice
                        await invoice.save()

                        // Block usage of this pending invoice until this payment is finished (failed or succeeded)
                        pendingInvoice.invoiceId = invoice.id
                        await pendingInvoice.save()
                    }

                    // Add the items to our invoice
                    invoice.meta.items.push(...pendingInvoice.meta.items)
                }

                // Update price
                price = invoice.meta.priceWithVAT
            }

            if (price > 0 && !request.body.proForma) {
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

                if (!user.organization.serverMeta.mollieCustomerId) {
                    const mollieCustomer = await mollieClient.customers.create({
                        name: user.organization.name,
                        email: user.email,
                        metadata: {
                            organizationId: user.organization.id,
                            userId: user.id,
                        }
                    })
                    user.organization.serverMeta.mollieCustomerId = mollieCustomer.id
                    await user.organization.save()
                }

                const molliePayment = await mollieClient.payments.create({
                    amount: {
                        currency: 'EUR',
                        value: (price / 100).toFixed(2)
                    },
                    method: payment.method == PaymentMethod.Bancontact ? molliePaymentMethod.bancontact : molliePaymentMethod.ideal,
                    description,
                    customerId: user.organization.serverMeta.mollieCustomerId,
                    sequenceType: SequenceType.first,
                    redirectUrl: "https://"+process.env.HOSTNAME_DASHBOARD+'/settings/billing/payment?id='+encodeURIComponent(payment.id),
                    webhookUrl: 'https://'+process.env.HOSTNAME_API+"/v"+Version+"/billing/payments/"+encodeURIComponent(payment.id)+"?exchange=true",
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
                    invoice: await invoice.getStructure()
                }));
            }

            if (request.body.proForma) {
                // We don't save the invoice, just return it
                return new Response(STInvoiceResponse.create({
                    paymentUrl: undefined,
                    invoice: await invoice.getStructure()
                }));
            }

            // No need to save the invoice, since it was free

            // Validate all packages
            for (const model of models) {
                await model.activate()
            }

            await STPackage.updateOrganizationPackages(user.organizationId)
            return new Response(STInvoiceResponse.create({
                paymentUrl: undefined,
                invoice: undefined
            }));
        });
    }
}

