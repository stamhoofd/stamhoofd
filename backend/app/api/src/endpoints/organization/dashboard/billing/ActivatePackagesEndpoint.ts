import { createMollieClient, MandateStatus, PaymentMethod as molliePaymentMethod, SequenceType } from '@mollie/api-client';
import { ArrayDecoder, AutoEncoder, AutoEncoderPatchType, BooleanDecoder, Decoder, EnumDecoder, field, StringDecoder } from "@simonbackx/simple-encoding";
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { isSimpleError, isSimpleErrors, SimpleError } from "@simonbackx/simple-errors";
import { MolliePayment, Payment, Registration, STCredit, STInvoice, STPackage, STPendingInvoice, Token } from "@stamhoofd/models";
import { QueueHandler } from '@stamhoofd/queues';
import { Company,Organization as OrganizationStruct, OrganizationPatch, PaymentMethod, PaymentProvider, PaymentStatus, STInvoiceItem, STInvoiceResponse, STPackage as STPackageStruct, STPackageBundle, STPackageBundleHelper, STPricingType, TransferSettings, User as UserStruct, Version } from "@stamhoofd/structures";

import { Context } from '../../../../helpers/Context';
import { ViesHelper } from '../../../../helpers/ViesHelper';

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

    /**
     * In case a new mandate has to be created.
     * 
     * Set to unknown to not create a new mandate (only works if total price is 0)
     * 
     * When used, the minimum amount will be set to 2 cents or a different value depending on the payment method.
     */
    @field({ decoder: new EnumDecoder(PaymentMethod) })
    paymentMethod: PaymentMethod = PaymentMethod.Unknown

     /**
     * In case to use an existing mandate: the mandate id of Mollie to use.
     * It should be a mandate of the Mollie customer linked to the organization.
     * 
     * If this mandate is valid, it will be set as the new default mandate for the organization.
     */
    @field({ decoder: StringDecoder, optional: true, nullable: true })
    mandateId: string | null = null

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
        if (!Context.auth.canActivatePackages()) {
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

        if (!request.body.proForma && request.body.organizationPatch) {
            // Validate VAT info
            const company = Company.create({
                name: organization.meta.companyName || '',
                VATNumber: organization.meta.VATNumber,
                companyNumber: organization.meta.companyNumber,
                address: organization.meta.companyAddress,
            })

            await ViesHelper.checkCompany(company, company);

            // Auto correct
            organization.meta.VATNumber = company.VATNumber
            organization.meta.companyNumber = company.companyNumber
            organization.meta.companyName = company.name
            organization.meta.companyAddress = company.address

            if (company.name.length < 3 || company.name.toLowerCase() === 'vzw') {
                throw new SimpleError({
                    code: "invalid_company_name",
                    message: "Company name is too short",
                    human: "De bedrijfsnaam is te kort of ongeldig. Vul een geldige bedrijfsnaam in.",
                    field: "companyName"
                })
            }

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
            invoice.meta.companyEmail = user.email
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

                    if (membersCount === null && model.meta.pricingType === STPricingType.PerMember) {
                        membersCount = await Registration.getActiveMembers(organization.id)
                    }

                    if (model.meta.pricingType === STPricingType.PerMember) {
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
            if (invoice.meta.totalPrice > 0 || request.body.includePending) {
                
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

            // If we are going to link a payment method, set the minimum amount
            const minimumAmount = 2;

            if (request.body.paymentMethod !== PaymentMethod.Unknown && invoice.meta.totalPrice < minimumAmount && !request.body.proForma) {
                invoice.meta.items.push(
                    STInvoiceItem.create({
                        name: 'Verificatie bankkaart',
                        unitPrice: minimumAmount - invoice.meta.totalPrice,
                        canUseCredits: false
                    })
                )
            }

            if (request.body.mandateId && request.body.paymentMethod !== PaymentMethod.Unknown) {
                // can't set mandate with payment method
                throw new SimpleError({
                    code: "invalid_mandate",
                    message: "Mandate ID is not allowed with payment method",
                    human: "Je kan geen mandaat ID opgeven als je een betaalmethode kiest. Kies een betaalmethode of laat het veld leeg."
                })  
            }
            
            const price = invoice.meta.totalPrice

            if (price < 0) {
                throw new Error("Unexpected negative price")
            }

            if (!request.body.proForma) {
                // Mollie payment is required
                const apiKey = STAMHOOFD.MOLLIE_API_KEY
                if (!apiKey) {
                    throw new SimpleError({
                        code: "",
                        message: "Betalingen zijn tijdelijk onbeschikbaar"
                    })
                }
                const mollieClient = createMollieClient({ apiKey });

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
                    // New mandate via SEPA Direct Debit
                    _molliePaymentMethod = molliePaymentMethod.paybybank
                } else if (payment.method == PaymentMethod.Unknown) {
                    // Use an existing mandate to pay
                    if (price > 0 || request.body.bundles.find(b => STPackageBundleHelper.requiresMandate(b))) {
                        // Mandate is required
                        if (!request.body.mandateId) {
                            throw new SimpleError({
                                code: "no_mandate",
                                message: "mandateId required",
                                human: "Er is geen mandaat gevonden. Probeer te betalen via een andere betaalmethode of maak een nieuw mandaat aan.",
                                field: "mandateId"
                            })
                        }
                    }

                    if (price > 0) {
                        const pendingInvoice = await STPendingInvoice.getForOrganization(organization.id)

                        if (pendingInvoice && pendingInvoice.invoiceId !== null && pendingInvoice.invoiceId !== invoice.id) {
                            throw new SimpleError({
                                code: "payment_pending",
                                message: "Payment pending",
                                human: "Er is momenteel al een afrekening in behandeling (dit kan 3 werkdagen duren). Probeer een andere betaalmethode."
                            })
                        }
                    }
                    
                    // Use saved payment method
                    _molliePaymentMethod = undefined
                    sequenceType = SequenceType.recurring

                    if (request.body.mandateId) {
                        if (!organization.serverMeta.mollieCustomerId) {
                            throw new SimpleError({
                                code: "no_mollie_customer",
                                message: "Er is geen opgeslagen betaalmethode gevonden. Probeer te betalen via een andere betaalmethode."
                            })
                        }

                        // Validate mandate
                        try {
                            const mandate = await mollieClient.customerMandates.get(
                                request.body.mandateId,
                                {customerId: organization.serverMeta.mollieCustomerId}
                            )
                            if (mandate.status !== MandateStatus.valid) {
                                throw new SimpleError({
                                    code: "invalid_mandate",
                                    message: "Invalid mandate",
                                    human: "Het gekozen bankrekening of bankkaart is niet meer geldig, kies een andere of koppel een nieuwe.",
                                    field: "mandateId"
                                })
                            }

                            organization.serverMeta.mollieMandateId = request.body.mandateId
                            await organization.save()

                        } catch (e) {
                            console.error("Error getting mandate", e)
                            throw new SimpleError({
                                code: "invalid_mandate",
                                message: "Invalid mandate",
                                human: "Het gekozen bankrekening of bankkaart is niet meer geldig, kies een andere of koppel een nieuwe.",
                                field: "mandateId"
                            })
                        }
                        
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
                    let customerId = organization.serverMeta.mollieCustomerId

                    if (customerId) {
                        // check still valid
                        try {
                            await mollieClient.customers.get(customerId);
                        } catch (e) {
                            console.error("Error getting customer", e)
                            // Customer is not valid anymore, we need to create a new one
                            customerId = undefined;
                        }
                    }

                    if (!customerId) {
                        if (payment.method === PaymentMethod.Unknown) {
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
                        mandateId: request.body.mandateId ?? undefined,
                    });

                    if (request.body.mandateId) {
                        if (molliePayment.method === 'creditcard') {
                            console.log("Corrected payment method to creditcard")
                            payment.method = PaymentMethod.CreditCard
                            await payment.save();
                        }

                        if (molliePayment.method === 'directdebit') {
                            console.log("Corrected payment method to DirectDebit")
                            payment.method = PaymentMethod.DirectDebit
                            await payment.save();
                        }
                    }

                    console.log(molliePayment)
                    const paymentUrl = molliePayment.getCheckoutUrl() ?? undefined

                    // Save payment
                    const dbPayment = new MolliePayment()
                    dbPayment.paymentId = payment.id
                    dbPayment.mollieId = molliePayment.id
                    await dbPayment.save();

                    if (molliePayment.details && 'transferReference' in molliePayment.details && 'bankAccount' in molliePayment.details) {
                        const details = molliePayment.details
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

