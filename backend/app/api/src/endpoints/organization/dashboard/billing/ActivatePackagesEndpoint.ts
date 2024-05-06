import { createMollieClient, PaymentMethod as molliePaymentMethod, SequenceType } from '@mollie/api-client';
import { BankTransferDetails } from '@mollie/api-client/dist/types/src/data/payments/data';
import { ArrayDecoder, AutoEncoder, AutoEncoderPatchType, BooleanDecoder, Decoder, EnumDecoder, field, StringDecoder } from "@simonbackx/simple-encoding";
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { isSimpleError, isSimpleErrors, SimpleError } from "@simonbackx/simple-errors";
import { MolliePayment, Payment, Registration, STCredit, STInvoice, STPackage, STPendingInvoice, Token } from "@stamhoofd/models";
import { QueueHandler } from '@stamhoofd/queues';
import { Organization as OrganizationStruct, OrganizationPatch, PaymentMethod, PaymentProvider, PaymentStatus, STInvoiceItem, STInvoiceResponse, STPackage as STPackageStruct, STPackageBundle, STPackageBundleHelper, STPricingType, TransferSettings, User as UserStruct, Version } from "@stamhoofd/structures";

import { Context } from '../../../../helpers/Context';

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
        const organization = await Context.setOrganizationScope();
        const {user} = await Context.authenticate()

        // If the user has permission, we'll also search if he has access to the organization's key
        if (!await Context.auth.canActivatePackages(organization.id)) {
            throw Context.auth.error()
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
            organization.privateMeta.billingContact = user.firstName + " " + user.lastName
        }

        if (request.body.organizationPatch) {
            console.log("Received patch in activatePackagesEndpoint", request.body.organizationPatch)
            if (request.body.organizationPatch.address) {
                organization.address.patchOrPut(request.body.organizationPatch.address)
            }

            if (request.body.organizationPatch.meta) {
                organization.meta.patchOrPut(request.body.organizationPatch.meta)
            }
        }

        if (!request.body.proForma) {
            await organization.save();
        }

        return await QueueHandler.schedule("billing/invoices-"+organization.id, async () => {
            const currentPackages = await STPackage.getForOrganization(organization.id)

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
            
            const invoice = STInvoice.createFor(organization)
            const date = new Date()

            invoice.meta.ipAddress = request.request.getIP()
            invoice.meta.userAgent = request.headers["user-agent"] ?? null

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
                model.organizationId = organization.id

                // If type is 
                let amount = 1

                if (membersCount === null && pack.meta.pricingType === STPricingType.PerMember) {
                    membersCount = await Registration.getActiveMembers(organization.id)
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
                const currentPackages = await STPackage.getForOrganization(organization.id)

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
                        membersCount = await Registration.getActiveMembers(organization.id)
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
                const pendingInvoice = await STPendingInvoice.addAutomaticItems(organization)
                if (pendingInvoice && pendingInvoice.invoiceId === null && pendingInvoice.meta.items.length) {
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
            await STCredit.applyCredits(organization.id, invoice, request.body.proForma)
            
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
                payment.provider = PaymentProvider.Mollie

                // Do some quick validatiosn before creating the payment (otherwise we'll have to mark it as failed)
                let _molliePaymentMethod: molliePaymentMethod | undefined = molliePaymentMethod.bancontact
                let sequenceType: SequenceType | undefined = SequenceType.first

                if (payment.method == PaymentMethod.iDEAL) {
                    _molliePaymentMethod = molliePaymentMethod.ideal
                } else if (payment.method == PaymentMethod.CreditCard) {
                    _molliePaymentMethod = molliePaymentMethod.creditcard
                } else if (payment.method == PaymentMethod.Transfer) {
                    _molliePaymentMethod = molliePaymentMethod.banktransfer
                    sequenceType = SequenceType.oneoff
                } else if (payment.method == PaymentMethod.DirectDebit) {
                    const pendingInvoice = await STPendingInvoice.getForOrganization(organization.id)

                    if (pendingInvoice && pendingInvoice.invoiceId !== null && pendingInvoice.invoiceId !== invoice.id) {
                        throw new SimpleError({
                            code: "payment_pending",
                            message: "Payment pending",
                            human: "Er is momenteel al een afrekening in behandeling (dit kan 3 werkdagen duren). Probeer een andere betaalmethode."
                        })
                    }
                    
                    // Use saved payment method
                    _molliePaymentMethod = undefined
                    sequenceType = SequenceType.recurring

                    if (!organization.serverMeta.mollieCustomerId) {
                        throw new SimpleError({
                            code: "no_mollie_customer",
                            message: "Er is geen opgeslagen betaalmethode gevonden. Probeer te betalen via een andere betaalmethode."
                        })
                    }
                }

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
                    const apiKey = STAMHOOFD.MOLLIE_API_KEY
                    if (!apiKey) {
                        throw new SimpleError({
                            code: "",
                            message: "Betalingen zijn tijdelijk onbeschikbaar"
                        })
                    }
                    const mollieClient = createMollieClient({ apiKey });
                    let customerId = organization.serverMeta.mollieCustomerId

                    if (!organization.serverMeta.mollieCustomerId) {
                        if (payment.method === PaymentMethod.DirectDebit) {
                            throw new SimpleError({
                                code: "no_mollie_customer",
                                message: "Er is geen opgeslagen betaalmethode gevonden. Probeer te betalen via een andere betaalmethode."
                            })
                        }
                        const mollieCustomer = await mollieClient.customers.create({
                            name: organization.name,
                            email: user.email,
                            metadata: {
                                organizationId: organization.id,
                                userId: user.id,
                            }
                        })

                        customerId = mollieCustomer.id
                        organization.serverMeta.mollieCustomerId = mollieCustomer.id
                        console.log("Saving new mollie customer", mollieCustomer, "for organization", organization.id)
                        await organization.save()
                    }

                    const molliePayment = await mollieClient.payments.create({
                        amount: {
                            currency: 'EUR',
                            value: (price / 100).toFixed(2)
                        },
                        method: _molliePaymentMethod,
                        description,
                        customerId,
                        sequenceType,
                        redirectUrl: "https://"+STAMHOOFD.domains.dashboard+'/settings/billing/payment?id='+encodeURIComponent(payment.id),
                        webhookUrl: 'https://'+STAMHOOFD.domains.api+"/v"+Version+"/billing/payments/"+encodeURIComponent(payment.id)+"?exchange=true",
                        metadata: {
                            invoiceId: invoice.id,
                            paymentId: payment.id,
                        },
                        billingEmail: user.email,
                    });

                    if (molliePayment.method === 'creditcard') {
                        console.log("Corrected payment method to creditcard")
                        payment.method = PaymentMethod.CreditCard
                        await payment.save();
                    }

                    console.log(molliePayment)
                    const paymentUrl = molliePayment.getCheckoutUrl() ?? undefined

                    // Save payment
                    const dbPayment = new MolliePayment()
                    dbPayment.paymentId = payment.id
                    dbPayment.mollieId = molliePayment.id
                    await dbPayment.save();

                    if ((molliePayment.details as BankTransferDetails)?.transferReference) {
                        const details = molliePayment.details as BankTransferDetails
                        payment.transferSettings = TransferSettings.create({
                            iban: details.bankAccount,
                            creditor: 'Stamhoofd',
                        })
                        payment.transferDescription = details.transferReference
                        await payment.save()
                    }

                    if (sequenceType === SequenceType.recurring) {
                        // Activate package
                        await invoice.activatePackages(false)
                        await STPackage.updateOrganizationPackages(organization.id)

                        const pendingInvoice = await STPendingInvoice.getForOrganization(organization.id)
                        if (pendingInvoice) {
                            pendingInvoice.invoiceId = invoice.id
                            await pendingInvoice.save()
                        }
                    }

                    return new Response(STInvoiceResponse.create({
                        paymentUrl: paymentUrl,
                        invoice: await invoice.getStructure()
                    }));
                } catch (e) {
                    console.error(e)
                    payment.status = PaymentStatus.Failed
                    await payment.save()
                    await invoice.markFailed(payment, false)

                    if (isSimpleError(e) || isSimpleErrors(e)) {
                        throw e
                    }
                    throw new SimpleError({
                        code: "payment_failed",
                        message: "Er ging iets mis bij het aanmaken van de betaling. Probeer later opnieuw of contacteer ons als het probleem zich blijft voordoen ("+request.$t("shared.emails.general")+")"
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

