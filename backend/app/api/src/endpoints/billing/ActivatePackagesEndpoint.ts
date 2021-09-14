import { createMollieClient, PaymentMethod as molliePaymentMethod, SequenceType } from '@mollie/api-client';
import { ArrayDecoder, AutoEncoder, AutoEncoderPatchType, BooleanDecoder, Decoder, EnumDecoder, field, StringDecoder } from "@simonbackx/simple-encoding";
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { isSimpleError, isSimpleErrors, SimpleError } from "@simonbackx/simple-errors";
import { MolliePayment, STCredit } from "@stamhoofd/models";
import { Payment } from "@stamhoofd/models";
import { Registration } from "@stamhoofd/models";
import { STInvoice } from "@stamhoofd/models";
import { STPackage } from "@stamhoofd/models";
import { STPendingInvoice } from "@stamhoofd/models";
import { Token } from "@stamhoofd/models";
import { QueueHandler } from '@stamhoofd/queues';
import { Organization as OrganizationStruct, OrganizationPatch,PaymentMethod, PaymentStatus, STInvoiceItem,STInvoiceResponse, STPackage as STPackageStruct,STPackageBundle, STPackageBundleHelper, STPricingType, User as UserStruct, Version  } from "@stamhoofd/structures";
type Params = Record<string, never>;
type Query = undefined;
type ResponseBody = STInvoiceResponse;

class Body extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(new EnumDecoder(STPackageBundle)), optional: true })
    bundles: STPackageBundle[] = []

    @field({ decoder: new ArrayDecoder(StringDecoder), optional: true })
    renewPackageIds: string[] = []

    @field({ decoder: BooleanDecoder, optional: true })
    includePending = false

    @field({ decoder: new EnumDecoder(PaymentMethod) })
    paymentMethod: PaymentMethod

    @field({ decoder: BooleanDecoder, optional: true })
    proForma = false

    @field({ decoder: OrganizationPatch, optional: true })
    organizationPatch?: AutoEncoderPatchType<OrganizationStruct>

    @field({ decoder: UserStruct.patchType(), optional: true })
    userPatch?: AutoEncoderPatchType<UserStruct>
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

        // Apply patches if needed
        if (request.body.userPatch) {
            user.firstName = request.body.userPatch.firstName ?? user.firstName
            user.lastName = request.body.userPatch.lastName ?? user.lastName

            if (!request.body.proForma) {
                await user.save()
            }
        }

        // Apply patches if needed
        if (user.firstName && user.lastName) {
            user.organization.privateMeta.billingContact = user.firstName + " " + user.lastName
        }

        if (request.body.organizationPatch) {
            if (request.body.organizationPatch.address) {
                user.organization.address.patchOrPut(request.body.organizationPatch.address)
            }

            if (request.body.organizationPatch.meta) {
                user.organization.meta.patchOrPut(request.body.organizationPatch.meta)
            }

            if (request.request.getVersion() < 113 && request.body.organizationPatch.privateMeta?.VATNumber !== undefined) {
                user.organization.meta.VATNumber = request.body.organizationPatch.privateMeta?.VATNumber
            }

            if (request.request.getVersion() < 113 && request.body.organizationPatch.address) {
                user.organization.meta.businessAddress = user.organization.address
            }

            if (request.request.getVersion() < 113 && request.body.organizationPatch.name) {
                user.organization.meta.businessName = request.body.organizationPatch.name
            }
        }
        if (!request.body.proForma) {
            await user.organization.save()
        }

        return await QueueHandler.schedule("billing/invoices-"+user.organizationId, async () => {
            const currentPackages = await STPackage.getForOrganization(user.organization.id)

            // Create packages
            const packages: STPackageStruct[] = [];
            for (const bundle of request.body.bundles) {
                // Renew after currently running packages
                let date = new Date()
                
                let skip = false
                // Do we have a collision?
                for (const currentPack of currentPackages) {
                    if (!STPackageBundleHelper.isCombineable(bundle, STPackageStruct.create(currentPack))) {
                        if (!STPackageBundleHelper.isStackable(bundle, STPackageStruct.create(currentPack))) {
                            // WE skip silently
                            console.error("Tried to activate non combineable, non stackable packages...")
                            skip = true
                            continue
                            /*throw new SimpleError({
                                code: "not_combineable",
                                message: "Het pakket dat je wilt activeren is al actief of is niet combineerbaar. Herlaad de pagina, mogelijk zie je een verouderde weergave van jouw geactiveerde pakketten."
                            })*/
                        }
                        if (currentPack.validUntil !== null) {
                            const end = currentPack.validUntil
                            if (end > date) {
                                date = end
                            }
                        }
                        
                    }
                }

                if (skip) {
                    continue
                }
                packages.push(STPackageBundleHelper.getCurrentPackage(bundle, date))
            }
            
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

            // Calculate price
            if (invoice.meta.priceWithVAT > 0 || request.body.includePending) {
                
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
            }

            // Apply credits
            await STCredit.applyCredits(user.organization.id, invoice, request.body.proForma)
            
            const price = invoice.meta.priceWithVAT

            if (price < 0) {
                throw new Error("Unexpected negative price")
            }

            if (!request.body.proForma) {
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

                if (price == 0) {
                    await invoice.markPaid()
                    return new Response(STInvoiceResponse.create({
                        paymentUrl: undefined,
                        invoice: await invoice.getStructure()
                    }));
                }

                try {
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
                } catch (e) {
                    console.error(e)
                    payment.status = PaymentStatus.Failed
                    await payment.save()
                    await invoice.markFailed(payment)

                    if (isSimpleError(e) || isSimpleErrors(e)) {
                        throw e
                    }
                    throw new SimpleError({
                        code: "payment_failed",
                        message: "Er ging iets mis bij het aanmaken van de betaling. Probeer later opnieuw of contacteer ons als het probleem zich blijft voordoen (hallo@stamhoofd.be)"
                    })
                }
            }

            // We don't save the invoice, just return it
            return new Response(STInvoiceResponse.create({
                paymentUrl: undefined,
                invoice: await invoice.getStructure()
            }));
        });
    }
}

