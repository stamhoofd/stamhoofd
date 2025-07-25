import { createMollieClient } from '@mollie/api-client';
import { column, ManyToOneRelation, Model } from "@simonbackx/simple-database";
import { SimpleError } from '@simonbackx/simple-errors';
import { I18n } from "@stamhoofd/backend-i18n";
import { Email } from "@stamhoofd/email";
import { QueueHandler } from "@stamhoofd/queues";
import { calculateVATPercentage, Country, OrganizationPaymentMandate, OrganizationPaymentMandateDetails,Payment as PaymentStruct, PaymentMethod, STBillingStatus, STCredit as STCreditStruct, STInvoice as STInvoiceStruct, STInvoiceItem, STInvoiceMeta, STPackage as STPackageStruct, STPackageType, STPendingInvoice as STPendingInvoiceStruct } from '@stamhoofd/structures';
import { Sorter } from "@stamhoofd/utility";
import { v4 as uuidv4 } from "uuid";

import { InvoiceBuilder } from "../helpers/InvoiceBuilder";
import { Organization, Payment, STCredit, STPackage, STPendingInvoice, UsedRegisterCode } from './';

export class STInvoice extends Model {
    static table = "stamhoofd_invoices";

    private static numberCache: number | null = null

    // Columns
    @column({
        primary: true, type: "string", beforeSave(value) {
            return value ?? uuidv4();
        }
    })
    id!: string;

    /**
     * Is null for deleted organizations
     */
    @column({ foreignKey: STInvoice.organization, type: "string", nullable: true })
    organizationId: string | null;

    /**
     * An associated STCredit, that was used to remove credits from the user's credits.
     * If the invoice is marked as failed, we need to delete this one
     */
    @column({ type: "string", nullable: true })
    creditId: string | null = null

    /**
     * Note: always create a new invoice for failed payments. We never create an actual invoice until we received the payment
     */
    @column({ type: "string", nullable: true, foreignKey: STInvoice.payment })
    paymentId: string | null = null
    
    @column({ type: "json", decoder: STInvoiceMeta })
    meta: STInvoiceMeta

    /**
     * If the number is null, no invoice is generated yet. Its still a WIP invoice (not an official one!)
     */
    @column({ type: "integer", nullable: true })
    number: number | null = null

    @column({ type: "datetime", nullable: true })
    paidAt: Date | null = null

    /**
     * If a invoice was refunded because of a cancellation, we store the negative invoice id here
     */
    @column({ type: "string", nullable: true })
    negativeInvoiceId: string | null = null

    @column({
        type: "datetime", beforeSave(old?: any) {
            if (old !== undefined) {
                return old;
            }
            const date = new Date()
            date.setMilliseconds(0)
            return date
        }
    })
    createdAt: Date

    @column({
        type: "datetime", beforeSave() {
            const date = new Date()
            date.setMilliseconds(0)
            return date
        },
        skipUpdate: true
    })
    updatedAt: Date

    @column({ type: "string", nullable: true })
    reference: string | null = null

    static organization = new ManyToOneRelation(Organization, "organization");
    static payment = new ManyToOneRelation(Payment, "payment");

    static createFor(organization: Organization): STInvoice {
        const invoice = new STInvoice()
        invoice.organizationId = organization.id
        
        const date = new Date()
        invoice.meta = STInvoiceMeta.create({
            date,
            companyName: organization.meta.companyName ?? organization.name,
            companyContact: organization.privateMeta.billingContact ?? "",
            companyAddress: organization.meta.companyAddress ?? organization.address,
            companyVATNumber: organization.meta.VATNumber,
            companyNumber: organization.meta.companyNumber,
            VATPercentage: calculateVATPercentage(organization.meta.companyAddress ?? organization.address, organization.meta.VATNumber)
        })

        return invoice
    }

    updateVATPercentage() {
        this.meta.VATPercentage = calculateVATPercentage(this.meta.companyAddress, this.meta.companyVATNumber)
    }

    async getStructure() {
        let payment: Payment | undefined
        if (this.paymentId) {
            payment = await Payment.getByID(this.paymentId)
        }
        return STInvoiceStruct.create(Object.assign({}, this, {
            payment: payment ? PaymentStruct.create(payment) : null
        }))
    }

    async getPackages(): Promise<STPackage[]> {
        const ids = new Set<string>()

        for (const item of this.meta.items) {
            if (item.package) {
                ids.add(item.package.id)
            }
        }

        if (ids.size > 0) {
            const packages = await STPackage.getByIDs(...ids)

            if (packages.length !== ids.size) {
                console.warn("Invoice contains invalid package ids "+this.id)
            }
            return packages
        }

        return []
    }

    async getOrganizationActivePackages(): Promise<STPackage[]> {
        return this.organizationId ? (await STPackage.getForOrganization(this.organizationId)) : []
    }

    async activatePackages(paymentSucceeded = false) {
        const packages = await this.getPackages()
        
        // Search for all packages and activate them if needed (might be possible that they are already validated)
        for (const p of packages) {
            // It is possible that the meta of the package has changed in the previous loop call (in pack.activate), so we need to refetch it otherwise we get 'meta' conflicts
            const pack = (await STPackage.getByID(p.id)) ?? p
            console.log("Activating package "+pack.id)

            // We'll never have multiple invoices for the same package that are awaiting payments
            if (paymentSucceeded) {
                pack.meta.firstFailedPayment = null;
                pack.meta.paymentFailedCount = 0;
            }

            await pack.activate()

            // Activate doesn't save always, so save if needed:
            await pack.save()

            // Deactivate demo packages
            const remove: STPackageType[] = []
            if (pack.meta.type === STPackageType.Members) {
                // Remove demo
                remove.push(STPackageType.TrialMembers)
            }

            if (pack.meta.type === STPackageType.SingleWebshop || pack.meta.type === STPackageType.Webshops) {
                // Remove demo
                remove.push(STPackageType.TrialWebshops)
            }

            if (remove.length > 0 && this.organizationId) {
                // Get all packages
                const all = await STPackage.getForOrganization(this.organizationId)
                for (const pack of all) {
                    if (remove.includes(pack.meta.type)) {
                        console.log("Disabling demo package "+pack.id+" because package is bought.")
                        // Stop
                        pack.removeAt = new Date()
                        pack.removeAt.setTime(pack.removeAt.getTime() - 1000)
                        await pack.save()
                    }
                }
            }
        }
    }

    /**
     * WARNING: only call this in the correct queue!
     */
    async markPaid({sendEmail} = { sendEmail: true }) {
        // Schule on the queue because we are modifying pending invoices
        if (this.paidAt !== null) {
            return
        }

        this.paidAt = new Date()

        if (this.meta.priceWithoutVAT !== 0) {
            // Only assign a number if it was an non empty invoice
            await this.assignNextNumber()
        }

        if (this.creditId !== null) {
            const credit = await STCredit.getByID(this.creditId)
            if (credit) {
                // This credit was used to pay this invoice (partially)
                credit.description = this.number !== null ? "Factuur "+this.number : "Betaling "+this.id
                credit.expireAt = null;
                await credit.save()
            }
        }

        const packages = await this.getPackages()

        // Increase paid amounts and paid prices
        for (const item of this.meta.items) {
            if (item.package) {
                const pack = packages.find(p => p.id === item.package?.id)

                if (pack) {
                    // Increase paid amount
                    pack.meta.paidPrice += item.price

                    if (item.price < 0 && item.amount > 0) {
                        pack.meta.paidAmount -= item.amount
                    } else {
                        pack.meta.paidAmount += item.amount
                    }
                    await pack.save();
                }
            }
        }

        // Search for all packages and activate them if needed (might be possible that they are already validated)
        if (this.meta.priceWithVAT >= 0) {
            await this.activatePackages(true)
        }

        if (packages.length === 0 && this.meta.priceWithVAT >= 0) {
            // Mark payments succeeded
            const orgPackages = await this.getOrganizationActivePackages()
            for (const p of orgPackages) {
                if (p.meta.firstFailedPayment) {
                    const pack = (await STPackage.getByID(p.id)) ?? p
                    pack.meta.firstFailedPayment = null;
                    pack.meta.paymentFailedCount = 0;
                    await pack.save()
                }
            }
        }

        // If needed: remove the invoice items from the pending invoice
        if (this.organizationId) {
            const pendingInvoice = await STPendingInvoice.getForOrganization(this.organizationId)
            if (pendingInvoice) {
                // Remove all invoice items that were paid
                const newItems: STInvoiceItem[] = []
                for (const item of pendingInvoice.meta.items) {
                    const found = this.meta.items.find(i => i.id === item.id)
                    if (!found) {
                        newItems.push(item)
                    } else {
                        if (found.price !== item.price) {
                            console.warn("Price mismatch for item "+item.id+" in pending invoice "+pendingInvoice.id)

                            if (found.unitPrice !== item.unitPrice) {
                                console.warn("Unit price mismatch for item "+item.id+" in pending invoice "+pendingInvoice.id)
                            } else {
                                // Update remaining amount
                                const c = item.clone()
                                c.amount -= found.amount

                                if (c.amount > 0) {
                                    newItems.push(c)
                                    console.log("Updated invoice item "+item.id+" in pending invoice "+pendingInvoice.id + ' with remaining amount of '+c.amount)
                                } else {
                                    console.log("Removed invoice item "+item.id+" from pending invoice "+pendingInvoice.id + ' because remaining amount is 0')
                                }
                            }
                        } else {
                            console.log("Removed invoice item "+item.id+" from pending invoice "+pendingInvoice.id)
                        }
                    }
                }
                pendingInvoice.meta.items = newItems

                if (pendingInvoice.invoiceId === this.id) {
                    // Unlock the pending invoice: we allow new invoices to get created
                    pendingInvoice.invoiceId = null
                }
                await pendingInvoice.save()
            }

            // Force regeneration of organization meta data
            await STPackage.updateOrganizationPackages(this.organizationId)
        }
        
        if (this.number !== null && !this.meta.pdf) {
            await this.generatePdf()
        }

        if (this.organizationId && this.meta.pdf && this.number !== null && sendEmail && this.meta.priceWithVAT > 0) {
            const organization = await Organization.getByID(this.organizationId)
            if (organization) {
                const invoicingTo = await organization.getInvoicingToEmails()

                if (invoicingTo) {
                    // Send the e-mail
                    Email.sendInternal({
                        to: invoicingTo,
                        subject: "Factuur " + this.number + " voor " + organization.name,
                        text: "Dag "+organization.name+", \n\nBedankt voor jullie vertrouwen in Stamhoofd. In bijlage vinden jullie factuur "+ this.number +" voor jullie administratie. Deze werd al betaald, je hoeft dus geen actie meer te ondernemen. Neem gerust contact met ons op (via "+organization.i18n.$t("shared.emails.general")+") als je denkt dat er iets fout is gegaan of als je nog bijkomende vragen zou hebben.\n\nMet vriendelijke groeten,\nStamhoofd\n\n",
                        attachments: [
                            {
                                filename: "factuur-"+this.number+".pdf",
                                href: this.meta.pdf.getPublicPath(),
                                contentType: "application/pdf"
                            }
                        ]
                    }, organization.i18n)
                }
            }
        } else if (this.meta.pdf && this.number !== null && this.meta.priceWithVAT < 0) {
            // Send the e-mail
            Email.sendInternal({
                to: 'hallo@stamhoofd.be',
                bcc: "simon@stamhoofd.be",
                subject: "Creditnota " + this.number,
                text: "Beste, \n\nIn bijlage creditnota "+ this.number +" voor de administratie.\n\nMet vriendelijke groeten,\nStamhoofd\n\n",
                attachments: [
                    {
                        filename: "creditnota-"+this.number+".pdf",
                        href: this.meta.pdf.getPublicPath(),
                        contentType: "application/pdf"
                    }
                ]
            }, new I18n("nl", Country.Belgium))
        }

        // Reward if we have an open register code
        if (this.meta.priceWithVAT >= 100 && this.organizationId) {
            // We spend some money
            const code = await UsedRegisterCode.getFor(this.organizationId)
            if (code && !code.creditId) {
                console.log("Rewarding code "+code.id+" for payment")

                // Deze code werd nog niet beloond
                await code.reward()
            }
        }
    }

    /**
     * WARNING: only call this in the correct queue!
     */
    async undoMarkPaid({sendEmail} = { sendEmail: true }) {
        // Schule on the queue because we are modifying pending invoices
        if (this.paidAt === null || this.negativeInvoiceId) {
            return
        }
        if (this.meta.priceWithVAT <= 0) {
            return;
        }
        if (!this.paymentId) {
            return;
        }
        const payment = await Payment.getByID(this.paymentId)
        if (!payment) {
            return;
        }

        if (!this.organizationId) {
            return;
        }
        await QueueHandler.schedule("billing/invoices-" + this.organizationId, async () => {
            if (!this.organizationId) {
                return;
            }
            const organization = await Organization.getByID(this.organizationId)

            if (!organization) {
                throw new Error("Organization not found")
            }

            // Readd the invoice items to the pending invoice
            await STPendingInvoice.addItems(organization, this.meta.items)

            await STPackage.updateOrganizationPackages(this.organizationId)
            
            if (this.meta.pdf && this.number !== null && sendEmail) {
                const invoicingTo = await organization.getInvoicingToEmails()

                console.log("Sending failure e-mail to "+invoicingTo)

                // Send the e-mail
                if (payment.method === PaymentMethod.DirectDebit) {
                    Email.sendInternal({
                        to: invoicingTo || 'hallo@stamhoofd.be',
                        bcc: "simon@stamhoofd.be",
                        subject: "Betaling mislukt voor factuur " + this.number + " voor " + organization.name,
                        text: "Dag "+organization.name+", \n\nBij nazicht blijkt dat een betaling voor een eerdere factuur ("+this.number+") is mislukt (in bijlage). Dit kan voorvallen als jullie een betaling terugdraaien via jullie bank of als de domiciliëring is mislukt (bv. onvoldoende saldo). \n\nAls jullie de rekening van automatische betalingen willen wijzigen, kunnen jullie hiervoor deze gids volgen: https://"+organization.marketingDomain+"/docs/bankrekening-domiciliering-wijzigen/\n\nGelieve het openstaande bedrag zo snel mogelijk te betalen door in te loggen op Stamhoofd en in het tabblad 'Boekhouding' eventuele openstaande bedragen in orde te brengen. Bij vragen of bedenkingen over eventuele afrekeningen kan je ons ook steeds contacteren via "+organization.i18n.$t("shared.emails.general")+".\n\nMet vriendelijke groeten,\nStamhoofd\n\n",
                        attachments: [
                            {
                                filename: "factuur-"+this.number+".pdf",
                                href: this.meta.pdf.getPublicPath(),
                                contentType: "application/pdf"
                            }
                        ]
                    }, organization.i18n)
                } else if (payment.method === PaymentMethod.CreditCard) {
                    Email.sendInternal({
                        to: invoicingTo || 'hallo@stamhoofd.be',
                        bcc: "simon@stamhoofd.be",
                        subject: "Betaling mislukt voor factuur " + this.number + " voor " + organization.name,
                        text: "Dag "+organization.name+", \n\nBij nazicht blijkt dat een betaling voor een eerdere factuur ("+this.number+") is mislukt (in bijlage). Dit kan voorvallen als jullie een betaling terugdraaien via jullie bank of als de betaling is mislukt (bv. onvoldoende saldo). \n\nAls jullie de rekening van automatische betalingen willen wijzigen, kunnen jullie hiervoor deze gids volgen: https://"+organization.marketingDomain+"/docs/bankrekening-domiciliering-wijzigen/\n\nGelieve het openstaande bedrag zo snel mogelijk te betalen door in te loggen op Stamhoofd en in het tabblad 'Boekhouding' eventuele openstaande bedragen in orde te brengen. Bij vragen of bedenkingen over eventuele afrekeningen kan je ons ook steeds contacteren via "+organization.i18n.$t("shared.emails.general")+".\n\nMet vriendelijke groeten,\nStamhoofd\n\n",
                        attachments: [
                            {
                                filename: "factuur-"+this.number+".pdf",
                                href: this.meta.pdf.getPublicPath(),
                                contentType: "application/pdf"
                            }
                        ]
                    }, organization.i18n)
                } else {
                    Email.sendInternal({
                        to: invoicingTo || 'hallo@stamhoofd.be',
                        bcc: "simon@stamhoofd.be",
                        subject: "Betaling teruggedraaid voor factuur " + this.number + " voor " + organization.name,
                        text: "Dag "+organization.name+", \n\nBij nazicht blijkt dat een betaling voor een eerdere factuur toch is mislukt.\n\nGelieve dit zo snel mogelijk na te kijken door in te loggen op Stamhoofd en in het tabblad 'Boekhouding' eventuele openstaande bedragen te betalen.\n\nBij vragen of bedenkingen bij eventuele afrekeningen kan je ons ook steeds contacteren via "+organization.i18n.$t("shared.emails.general")+".\n\nMet vriendelijke groeten,\nStamhoofd\n\n",
                        attachments: [
                            {
                                filename: "factuur-"+this.number+".pdf",
                                href: this.meta.pdf.getPublicPath(),
                                contentType: "application/pdf"
                            }
                        ]
                    }, organization.i18n)
                }
            } else {
                console.warn("No invoice pdf found for invoice "+this.id + ", not sending failure e-mail")
            }

            await this.createRefundInvoice()
        });
    }

    async createRefundInvoice() {
        if (this.negativeInvoiceId) {
            console.log('Refund invoice already created for '+this.id)
            return
        }

        console.log('Creating refund invoice for '+this.id)
        const invoice = new STInvoice()
        invoice.organizationId = this.organizationId
        
        const date = new Date()
        invoice.meta = STInvoiceMeta.create({
            ...this.meta,
            date,
            pdf: undefined
        })
        invoice.meta.items = this.meta.items.map(i => i.clone())

        // Loop items and set price to negative
        for (const item of invoice.meta.items) {
            item.unitPrice = -item.unitPrice

            // Create new item id
            item.id = uuidv4()
        }
        await invoice.save()
        await invoice.markPaid({ sendEmail: false})

        this.negativeInvoiceId = invoice.id
        await this.save()

        return invoice
    }

    async assignNextNumber() {
        return await QueueHandler.schedule("billing/invoice-numbers", async () => {
            // Get clone
            const refreshed = await STInvoice.getByID(this.id)
            if (!refreshed || refreshed.number !== null) {
                return
            }
            // Removed the cache because not working across multiple instances
            // if (STInvoice.numberCache) {
            //     this.number = STInvoice.numberCache + 1
            //     await this.save()
            // 
            //     // If save succeeded: increase it
            //     STInvoice.numberCache++;
            //     return
            // }
            const lastInvoice = await STInvoice.where({ number: { value: null, sign: "!=" }}, { sort: [{ column: "number", direction: "DESC"}], limit: 1 })
            STInvoice.numberCache = lastInvoice[0]?.number ?? 0
            
            this.number = STInvoice.numberCache + 1
            this.meta.date = new Date()
            await this.save()

            // If save succeeded: increase it
            STInvoice.numberCache++;
            return
        })
    }

    async generatePdf() {
        const builder = new InvoiceBuilder(this)
        this.meta.pdf = await builder.build()
        await this.save()
    }

    /**
     * WARNGING: only call this method in the correct queue!
     */
    async markFailed(payment: Payment, markFailed = true) {
        if (this.negativeInvoiceId) {
            // Already handled
            return;
        }
        console.log("Mark invoice as failed", this.id)

        const packages = await this.getPackages()

        if (markFailed && (payment.method === PaymentMethod.DirectDebit || payment.method === PaymentMethod.Transfer)) {
            // Only mark failed payments for background payments
            for (const pack of packages) {
                console.log("Marking package with failed payment "+pack.id)

                pack.meta.firstFailedPayment = pack.meta.firstFailedPayment ?? new Date()
                pack.meta.paymentFailedCount++;
                await pack.save()

            }

            if (packages.length == 0) {
                // Mark all active packages as failed
                const activePackages = await this.getOrganizationActivePackages()
                for (const pack of activePackages) {
                    console.log("Marking package with failed payment "+pack.id)

                    pack.meta.firstFailedPayment = pack.meta.firstFailedPayment ?? new Date()
                    pack.meta.paymentFailedCount++;
                    await pack.save()
                }
            }
        }
        

        if (this.organizationId) {
            const pendingInvoice = await STPendingInvoice.getForOrganization(this.organizationId)
            if (pendingInvoice && pendingInvoice.invoiceId === this.id) {
                pendingInvoice.invoiceId = null

                // Also update the packages in the pending invoice itself
                for (const item of pendingInvoice.meta.items) {
                    const pack = item.package
                    if (pack) {
                        const pp = packages.find(p => p.id === pack.id)
                        if (pp) {
                            console.log("Updated package "+pp.id+" in pending invoice")
                            // Update reference to include new failed counts
                            item.package = STPackageStruct.create(pp)
                        }
                    }
                }

                await pendingInvoice.save()
            }

            // Force regeneration of organization meta data
            await STPackage.updateOrganizationPackages(this.organizationId)
        }

        if (this.creditId !== null && !this.paidAt) {
            const credit = await STCredit.getByID(this.creditId)
            if (credit && (credit.expireAt === null || credit.expireAt > new Date())) {
                // Expire usage (do not delete to keep the relation for debugging and recovery)
                credit.expireAt = new Date(new Date().getTime() - 1000);
                await credit.save()
            }
        }

        if (!this.number) {
            if (markFailed && this.organizationId && payment.method === PaymentMethod.DirectDebit) {
                const organization = await Organization.getByID(this.organizationId)
                if (organization) {
                    const invoicingTo = await organization.getInvoicingToEmails()

                    if (invoicingTo) {
                        // Send the e-mail
                        Email.sendInternal({
                            to: invoicingTo,
                            bcc: "simon@stamhoofd.be",
                            subject: "Betaling mislukt voor "+organization.name,
                            text: "Dag "+organization.name+", \n\nDe automatische betaling via domiciliëring van jullie openstaande bedrag is mislukt (zie daarvoor onze vorige e-mail). Kijk even na wat er fout ging en betaal het openstaande bedrag manueel om te vermijden dat bepaalde diensten tijdelijk worden uitgeschakeld. Betalen kan via Stamhoofd > Instellingen > Facturen en betaalinstellingen > Openstaand bedrag > Afrekenen. Neem gerust contact met ons op als je bijkomende vragen hebt.\n\nMet vriendelijke groeten,\nStamhoofd\n\n",
                        }, organization.i18n)
                    } else {
                        console.warn("No invoicing e-mail found for "+organization.name)
                    }
                }
            }

            if (markFailed && this.organizationId && payment.method === PaymentMethod.Transfer) {
                const organization = await Organization.getByID(this.organizationId)
                if (organization) {
                    const invoicingTo = await organization.getInvoicingToEmails()

                    if (invoicingTo) {
                        // Send the e-mail
                        Email.sendInternal({
                            to: invoicingTo,
                            bcc: "simon@stamhoofd.be",
                            subject: "Betaling mislukt voor "+organization.name,
                            text: "Dag "+organization.name+", \n\nBij nazicht blijkt dat we geen overschrijving hebben ontvangen voor jullie aankoop. Kijk even na wat er fout ging en betaal het openstaande bedrag om te vermijden dat de diensten worden uitgeschakeld. Betalen kan via Stamhoofd > Instellingen > Facturen en betaalinstellingen > Openstaand bedrag > Afrekenen. Neem gerust contact met ons op als je bijkomende vragen hebt.\n\nMet vriendelijke groeten,\nStamhoofd\n\n",
                        }, organization.i18n)
                    }
                }
            }
        } else {
            await this.undoMarkPaid({ sendEmail: true })
        }
    }


    static async getBillingStatus(organization: Organization, hideExpired = true): Promise<STBillingStatus> {
        // Get all packages
        const packages = hideExpired ? (await STPackage.getForOrganization(organization.id)) : (await STPackage.getForOrganizationIncludingExpired(organization.id))

        // GEt all invoices
        const invoices = await STInvoice.where({ organizationId: organization.id, number: { sign: "!=", value: null }})

        // Get the pending invoice if it exists
        const pendingInvoice = await STPendingInvoice.getForOrganization(organization.id)

        // Generate temporary pending invoice items for the current state without adding them IRL
        let notYetCreatedItems: STInvoiceItem[] = []
        try {
            notYetCreatedItems = await STPendingInvoice.createItems(organization.id, pendingInvoice)
        } catch (e) {
            console.error(e)
        }
        const pendingInvoiceStruct = pendingInvoice ? STPendingInvoiceStruct.create(pendingInvoice) : (notYetCreatedItems.length > 0 ? STPendingInvoiceStruct.create({
            meta: STInvoiceMeta.create({
                companyName: organization.meta.companyName ?? organization.name,
                companyContact: organization.privateMeta.billingContact ?? "",
                companyAddress: organization.meta.companyAddress ?? organization.address,
                companyVATNumber: organization.meta.VATNumber,
                VATPercentage: calculateVATPercentage(organization.meta.companyAddress ?? organization.address, organization.meta.VATNumber)
            })
        }) : null)
        
        if (notYetCreatedItems.length > 0 && pendingInvoiceStruct) {
            pendingInvoiceStruct.meta.items.push(...notYetCreatedItems)
        }

        if (pendingInvoiceStruct) {
            // Compress
            pendingInvoiceStruct.meta.items = STInvoiceItem.compress(pendingInvoiceStruct.meta.items)
        }

     
        if (pendingInvoice?.invoiceId && pendingInvoiceStruct) {
            const invoice = await STInvoice.getByID(pendingInvoice?.invoiceId)
            if (invoice) {
                pendingInvoiceStruct.invoice = await invoice.getStructure()
            }
        }
        invoices.sort((a, b) => Sorter.byDateValue(a.createdAt, b.createdAt))

        const invoiceStructures: STInvoiceStruct[] = []
        for (const invoice of invoices) {
            invoiceStructures.push(await invoice.getStructure())
        }

        const credits = await STCredit.getForOrganization(organization.id)

        return STBillingStatus.create({
            packages: packages.map(pack => STPackageStruct.create(pack)),
            invoices: invoiceStructures,
            pendingInvoice: pendingInvoiceStruct,
            credits: credits.map(c => STCreditStruct.create(c)),
            mandates: await this.getMollieMandates(organization),
        });
    }

    static async getMollieMandates(organization: Organization) {
        // Poll mollie status
        // Mollie payment is required
        const mandates: OrganizationPaymentMandate[] = []

        try {
            const apiKey = STAMHOOFD.MOLLIE_API_KEY
            if (!apiKey) {
                throw new SimpleError({
                    code: "",
                    message: "Mollie niet correct gekoppeld"
                })
            }
            
            const mollieClient = createMollieClient({ apiKey });

            if (organization.serverMeta.mollieCustomerId) {
                const m = await mollieClient.customerMandates.page({ customerId: organization.serverMeta.mollieCustomerId, limit: 250 })
                for (const mandate of m) {
                    try {
                        const details = mandate.details
                        mandates.push(OrganizationPaymentMandate.create({
                            ...mandate,
                            isDefault: mandate.id === organization.serverMeta.mollieMandateId,
                            createdAt: new Date(mandate.createdAt),
                            details: OrganizationPaymentMandateDetails.create({
                                consumerName: ('consumerName' in details ? details.consumerName : details.cardHolder) ?? undefined,
                                consumerAccount: ('consumerAccount' in details ? details.consumerAccount : details.cardNumber) ?? undefined,
                                consumerBic: ('consumerBic' in details ? details.consumerBic : details.cardExpiryDate) ?? undefined,
                                cardExpiryDate: ('cardExpiryDate' in details ? details.cardExpiryDate : null),
                                cardLabel: ('cardLabel' in details ? details.cardLabel : null),
                            })
                        }))
                    } catch (e) {
                        console.error(e)
                    }
                }
            }
        } catch (e) {
            console.error(e)
        }
        return mandates;
    }
}
