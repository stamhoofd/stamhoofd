import { createMollieClient } from '@mollie/api-client';
import { column, ManyToOneRelation, Model } from "@simonbackx/simple-database";
import { SimpleError } from '@simonbackx/simple-errors';
import { I18n } from "@stamhoofd/backend-i18n";
import { Email } from "@stamhoofd/email";
import { QueueHandler } from "@stamhoofd/queues";
import { calculateVATPercentage, Country, File, OrganizationPaymentMandate, OrganizationPaymentMandateDetails, Payment as PaymentStruct, PaymentMethod, PaymentStatus, STBillingStatus, STCredit as STCreditStruct, STInvoice as STInvoiceStruct, STInvoiceItem, STInvoiceMeta, STPackage as STPackageStruct, STPackageType, STPendingInvoice as STPendingInvoiceStruct } from '@stamhoofd/structures';
import { Formatter, Sorter } from "@stamhoofd/utility";
import AWS from 'aws-sdk';
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

    @column({ type: "boolean" })
    didSendPeppol = false;

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

    async officialize() {
        if (this.meta.priceWithoutVAT === 0) {
            // Only assign a number if it was an non empty invoice
            return;
        }

        if (this.number) {
            // Already officialized
            return;
        }

        await this.assignNextNumber()

        if (this.number !== null && !this.meta.pdf) {
            await this.generatePdf()
            await this.generateUBL()
        }

        await this.sendPeppol();

        // Send via e-mail if not sending via PEPPOL
        if (!this.didSendPeppol) {
            if (this.organizationId && this.meta.pdf && this.number !== null && this.meta.totalPrice > 0) {
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
                                    filename: this.generateFilename('pdf'),
                                    href: this.meta.pdf.getPublicPath(),
                                    contentType: "application/pdf"
                                },
                                ...(this.meta.xml ? [{
                                    filename: this.generateFilename('xml'),
                                    href: this.meta.xml.getPublicPath(),
                                    contentType: "application/xml"
                                }] : [])
                            ]
                        }, organization.i18n)
                    }
                }
            } else if (this.meta.pdf && this.number !== null && this.meta.totalPrice < 0) {
                // Send the e-mail
                Email.sendInternal({
                    to: 'hallo@stamhoofd.be',
                    bcc: "simon@stamhoofd.be",
                    subject: "Creditnota " + this.number,
                    text: "Beste, \n\nIn bijlage creditnota "+ this.number +" voor de administratie.\n\nMet vriendelijke groeten,\nStamhoofd\n\n",
                    attachments: [
                        {
                            filename: this.generateFilename('pdf'),
                            href: this.meta.pdf.getPublicPath(),
                            contentType: "application/pdf"
                        },
                        ...(this.meta.xml ? [{
                            filename: this.generateFilename('xml'),
                            href: this.meta.xml.getPublicPath(),
                            contentType: "application/xml"
                        }] : [])
                    ]
                }, new I18n("nl", Country.Belgium))
            }
        } else {
            console.log('Skipped sending invoice via email: already sent via PEPPOL')
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

        // Only assign a number if it was an non empty invoice
        await this.officialize()

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
        if (this.meta.totalPrice >= 0) {
            await this.activatePackages(true)
        }

        if (packages.length === 0 && this.meta.totalPrice >= 0) {
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
                                c.firstFailedPayment = null;
                                c.paymentFailedCount = 0;
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

        // Reward if we have an open register code
        if (this.meta.totalPrice >= 100 && this.organizationId) {
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
        if (this.meta.totalPrice <= 0) {
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
                                filename: this.generateFilename('pdf'),
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
                                filename: this.generateFilename('pdf'),
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
                                filename: this.generateFilename('pdf'),
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
            pdf: undefined,
            xml: undefined
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

        if (markFailed && (this.meta.backgroundCharge || payment.method === PaymentMethod.DirectDebit || payment.method === PaymentMethod.Transfer)) {
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

        let isPendingInvoicePayment = false;

        if (this.organizationId) {
            const pendingInvoice = await STPendingInvoice.getForOrganization(this.organizationId)
            if (pendingInvoice && pendingInvoice.invoiceId === this.id) {
                pendingInvoice.invoiceId = null
                isPendingInvoicePayment = true;

                // Also update the packages in the pending invoice itself
                for (const item of pendingInvoice.meta.items) {
                    const pack = item.package

                    if (!item.firstFailedPayment) {
                        item.firstFailedPayment = new Date()
                    }
                    item.paymentFailedCount = (item.paymentFailedCount ?? 0) + 1

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
            if (
                markFailed 
                && this.organizationId 
                && (
                    this.meta.backgroundCharge 
                    || (
                        isPendingInvoicePayment && (payment.method === PaymentMethod.DirectDebit || payment.method === PaymentMethod.CreditCard)
                    )
                )
            ) {
                const organization = await Organization.getByID(this.organizationId)
                if (organization) {
                    const invoicingTo = await organization.getInvoicingToEmails()

                    if (invoicingTo) {
                        // Send the e-mail
                        Email.sendInternal({
                            to: invoicingTo,
                            bcc: "simon@stamhoofd.be",
                            subject: "Betaling mislukt voor "+organization.name,
                            text: "Dag "+organization.name+", \n\nDe betaling van jullie openstaande bedrag is mislukt (zie daarvoor onze vorige e-mail). Kijk even na wat er fout ging en betaal het openstaande bedrag manueel om te vermijden dat bepaalde diensten tijdelijk worden uitgeschakeld. Gebruik hiervoor nooit een persoonlijke rekening. Betalen kan via Stamhoofd > Instellingen > Facturen en betaalinstellingen > Openstaand bedrag > Afrekenen. Neem gerust contact met ons op als je bijkomende vragen hebt.\n\nMet vriendelijke groeten,\nStamhoofd\n\n",
                        }, organization.i18n)
                    } else {
                        console.warn("No invoicing e-mail found for "+organization.name)
                    }
                }
            } else if (markFailed && this.organizationId && payment.method === PaymentMethod.Transfer) {
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

    generateFilename(ext: 'pdf' | 'xml') {
        if (!this.number) {
            return this.id + '.' + ext;
        }
        const date = this.meta.date ?? this.paidAt ?? this.createdAt ?? new Date();
        return Formatter.dateIso(date) + ' - ' + (this.meta.totalPrice < 0 ? 'Creditnota' : 'Factuur') + ' ' + this.number + ' - Stamhoofd.' + ext;
    }

    async buildUBL() {
        if (!this.number) {
            throw new Error('Cannot generate UBL for invoice without number');
        }

        const companyNumberOrVAT = this.meta.companyVATNumber ?? this.meta.companyNumber;
        if (!companyNumberOrVAT) {
            throw new Error('Cannot generate UBL for invoice without VAT or company number');
        }

        if (this.meta.companyAddress.country !== Country.Belgium) {
            throw new Error('Cannot generate UBL for invoice outside belgium');
        }
        const companyNumber = (this.meta.companyVATNumber ? this.meta.companyVATNumber.substring(2) : companyNumberOrVAT).replace(/[^0-9]+/g, '');

        const payment = this.paymentId ? (await Payment.getByID(this.paymentId)) : null;

        const pdfBuilder = new InvoiceBuilder(this)
        const pdfBuffer = await pdfBuilder.buildBuffer();

        const type = this.meta.totalPrice < 0 ? 'CreditNote': 'Invoice';
        const multiplyAmounts = this.meta.totalPrice < 0 ? -1 : 1;

        let customerEmail: string | null = this.meta.companyEmail ?? null
        if (!customerEmail && this.organizationId) {
            const organization = await Organization.getByID(this.organizationId)
            if (organization) {
                customerEmail = (await organization.getInvoicingToEmail()) ?? null
            }
        }

        let ubl = ``;

        function esc(a: string) {
            return Formatter.escapeHtml(a);
        }

        // Docs: https://docs.peppol.eu/poacc/billing/3.0/syntax/ubl-invoice/
        // Note: order is important

        // General
        ubl += `<cbc:ID>${esc(this.number.toFixed(0))}</cbc:ID>`;
        const date = this.meta.date ?? this.paidAt ?? this.createdAt ?? new Date();
        ubl += `<cbc:IssueDate>${esc(Formatter.dateIso(date))}</cbc:IssueDate>`;

        // PEPPOL allows credit notes as negative invoices, so we always use invoice type code = invoice
        
        if (type === 'Invoice') {
            ubl += `<cbc:DueDate>${esc(Formatter.dateIso(new Date(date.getTime() + 1000 * 60 * 60 * 24 * 30)))}</cbc:DueDate>`;
            ubl += `<cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>`;
        } else {
            ubl += `<cbc:CreditNoteTypeCode>381</cbc:CreditNoteTypeCode>`;
        }

        ubl += `<cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>`;
        ubl += `<cbc:BuyerReference>${esc(this.organizationId ?? this.id)}</cbc:BuyerReference>`;

        // Attachments
        const filename = this.generateFilename('pdf');
        const base64 = pdfBuffer.toString('base64'); // No escaping needed for this charset
        ubl += `
            <cac:AdditionalDocumentReference>
                <cbc:ID>${esc(filename)}</cbc:ID>
                <cac:Attachment>
                    <cbc:EmbeddedDocumentBinaryObject mimeCode="application/pdf" filename="${esc(filename)}">${base64}</cbc:EmbeddedDocumentBinaryObject>
                </cac:Attachment>
            </cac:AdditionalDocumentReference>`;
        
        // Supplier
        ubl += `
            <cac:AccountingSupplierParty>
                <cac:Party>
                    <cbc:EndpointID schemeID="0208">0747832683</cbc:EndpointID>
                    <cac:PartyName>
                        <cbc:Name>Stamhoofd</cbc:Name>
                    </cac:PartyName>
                    <cac:PostalAddress>
                        <cbc:StreetName>Collegiebaan 54</cbc:StreetName>
                        <cbc:CityName>Wetteren</cbc:CityName>
                        <cbc:PostalZone>9230</cbc:PostalZone>
                        <cac:Country>
                            <cbc:IdentificationCode>BE</cbc:IdentificationCode>
                        </cac:Country>
                    </cac:PostalAddress>
                    <cac:PartyTaxScheme>
                        <cbc:CompanyID>BE0747832683</cbc:CompanyID>
                        <cac:TaxScheme>
                            <cbc:ID>VAT</cbc:ID>
                        </cac:TaxScheme>
                    </cac:PartyTaxScheme>
                    <cac:PartyLegalEntity>
                        <cbc:RegistrationName>Codawood BV</cbc:RegistrationName>
                        <cbc:CompanyID schemeID="0208">0747832683</cbc:CompanyID>
                    </cac:PartyLegalEntity>
                    <cac:Contact>
                        <cbc:ElectronicMail>hallo@stamhoofd.be</cbc:ElectronicMail>
                    </cac:Contact>
                </cac:Party>
            </cac:AccountingSupplierParty>`;

        const vatUbl = this.meta.companyVATNumber 
            ? `<cac:PartyTaxScheme>
                    <cbc:CompanyID>${esc(this.meta.companyVATNumber.replace(/[^A-z0-9]+/g, ''))}</cbc:CompanyID>
                    <cac:TaxScheme>
                        <cbc:ID>VAT</cbc:ID>
                    </cac:TaxScheme>
                </cac:PartyTaxScheme>` 
            : ``;

        const contactUbl = customerEmail
            ? `<cac:Contact>
                    <cbc:ElectronicMail>${esc(customerEmail)}</cbc:ElectronicMail>
                </cac:Contact>`
            : '';

        // Customer
        ubl += `
            <cac:AccountingCustomerParty>
                <cac:Party>
                    <cbc:EndpointID schemeID="0208">${esc(companyNumber)}</cbc:EndpointID>
                    <cac:PartyName>
                        <cbc:Name>${esc(this.meta.companyName)}</cbc:Name>
                    </cac:PartyName>
                    <cac:PostalAddress>
                        <cbc:StreetName>${esc(this.meta.companyAddress.street)} ${esc(this.meta.companyAddress.number)}</cbc:StreetName>
                        <cbc:CityName>${esc(this.meta.companyAddress.city)}</cbc:CityName>
                        <cbc:PostalZone>${esc(this.meta.companyAddress.postalCode)}</cbc:PostalZone>
                        <cac:Country>
                            <cbc:IdentificationCode>${esc(this.meta.companyAddress.country)}</cbc:IdentificationCode>
                        </cac:Country>
                    </cac:PostalAddress>
                    ${vatUbl}
                    <cac:PartyLegalEntity>
                        <cbc:RegistrationName>${esc(this.meta.companyName)}</cbc:RegistrationName>
                        <cbc:CompanyID schemeID="0208">${esc(companyNumber)}</cbc:CompanyID>
                    </cac:PartyLegalEntity>
                    ${contactUbl}
                </cac:Party>
            </cac:AccountingCustomerParty>`;
        
        // Payment means
        // Codes: 
        // 49 = direct debit
        // 48 = bank card
        // 54 = credit card
        // 55 = debit card
        // 59 = SEPA direct debit
        // 68 = Online payment service <- probably way to go for all except tranfer
        // 30 = credit transfer (Payment by credit movement of funds from one account to another.) <- way to go for 

        if (!payment) {
            // Het bedrag werd reeds ingehouden van jouw Stripe balans.
            // Don't include payment means information
        } else {
            if (this.meta.totalPrice < 0) {
                // todo: add how we are going to pay back
                // 99% chance we already have paid back using a refund
                // in other cases we might transfer it manually or it will not have been paid already
            } else {
                if (payment.method === PaymentMethod.Transfer) {
                    ubl += `<cac:PaymentMeans>
                                <cbc:PaymentMeansCode>30</cbc:PaymentMeansCode>
                                <cbc:PaymentID>${esc(payment.transferDescription ?? '')}</cbc:PaymentID>
                                <cac:PayeeFinancialAccount>
                                    <cbc:ID>BE93733058873067</cbc:ID>
                                    <cbc:Name>Stamhoofd</cbc:Name>
                                </cac:PayeeFinancialAccount>
                            </cac:PaymentMeans>`;

                } else if (payment.status === PaymentStatus.Succeeded) {
                    const code = 48; // card - don't specify more

                    ubl += `<cac:PaymentMeans>
                        <cbc:PaymentMeansCode>${esc(code.toFixed(0))}</cbc:PaymentMeansCode>
                    </cac:PaymentMeans>`;
                }
            }
        }

        // Tax breakdown
        ubl += `<cac:TaxTotal>
            <cbc:TaxAmount currencyID="EUR">${(multiplyAmounts * this.meta.VAT / 100).toFixed(2)}</cbc:TaxAmount>`;

        if (this.meta.VATPercentage > 0 ) {
            ubl += `<cac:TaxSubtotal>
                    <cbc:TaxableAmount currencyID="EUR">${(multiplyAmounts * this.meta.priceWithoutVAT / 100).toFixed(2)}</cbc:TaxableAmount>
                    <cbc:TaxAmount currencyID="EUR">${(multiplyAmounts * this.meta.VAT / 100).toFixed(2)}</cbc:TaxAmount>
                    <cac:TaxCategory>
                        <cbc:ID>S</cbc:ID>
                        <cbc:Percent>${this.meta.VATPercentage.toFixed(2)}</cbc:Percent>
                        <cac:TaxScheme>
                            <cbc:ID>VAT</cbc:ID>
                        </cac:TaxScheme>
                    </cac:TaxCategory>
                </cac:TaxSubtotal>`;
        }
            
        ubl += `</cac:TaxTotal>`;

        // Totals
        // Since sometimes we have invoices that start with a given paid amount, and prices inclusive VAT, we can have rounding issues.
        // In UBL, prices are always exclusive VAT.
        // so start with calculating the rounding error.
        // PayableRoundingAmount
        ubl += `<cac:LegalMonetaryTotal>
            <cbc:LineExtensionAmount currencyID="EUR">${(multiplyAmounts * this.meta.priceWithoutVAT / 100).toFixed(2)}</cbc:LineExtensionAmount>
            <cbc:TaxExclusiveAmount currencyID="EUR">${(multiplyAmounts * this.meta.priceWithoutVAT / 100).toFixed(2)}</cbc:TaxExclusiveAmount>
            <cbc:TaxInclusiveAmount currencyID="EUR">${(multiplyAmounts * this.meta.priceWithVAT / 100).toFixed(2)}</cbc:TaxInclusiveAmount>
            <cbc:PrepaidAmount currencyID="EUR">${!payment || payment.status === PaymentStatus.Succeeded ? (multiplyAmounts * this.meta.totalPrice / 100).toFixed(2) : '0'}</cbc:PrepaidAmount>
            <cbc:PayableRoundingAmount currencyID="EUR">${(multiplyAmounts * this.meta.payableRoundingAmount / 100).toFixed(2)}</cbc:PayableRoundingAmount>
            <cbc:PayableAmount currencyID="EUR">${!payment || payment.status === PaymentStatus.Succeeded ? '0' : (multiplyAmounts * this.meta.totalPrice / 100).toFixed(2)}</cbc:PayableAmount>
        </cac:LegalMonetaryTotal>`;

        // Invoice lines
        for (const item of this.meta.items) {
            // We need to show prices exluding VAT and round here if needed
            let unitPrice = item.unitPrice
            let price = item.price
            let amount = item.amount;

            if (this.meta.areItemsIncludingVAT) {
                unitPrice = this.meta.includingVATToExcludingVAT(unitPrice)
                price = this.meta.includingVATToExcludingVAT(price)
            }

            // unitPrice cant be negative, amount can.
            if (unitPrice < 0) {
                amount = -amount;
                unitPrice = -unitPrice;
            }

            // Update sign for credit notes
            amount = amount * multiplyAmounts;
            price = price * multiplyAmounts;

            ubl += `
                <cac:${type}Line>
                    <cbc:ID>${item.id}</cbc:ID>
                    <cbc:${type === 'Invoice' ? 'Invoiced' : 'Credited'}Quantity unitCode="EA">${amount.toFixed(0)}</cbc:${type === 'Invoice' ? 'Invoiced' : 'Credited'}Quantity>
                    <cbc:LineExtensionAmount currencyID="EUR">${(price / 100).toFixed(2)}</cbc:LineExtensionAmount>
                    <cac:Item>
                        ${item.description ? `<cbc:Description>${esc(item.description)}</cbc:Description>` : ''}
                        <cbc:Name>${esc(item.name)}</cbc:Name>
                        <cac:ClassifiedTaxCategory>
                            <cbc:ID>${this.meta.VATPercentage > 0  ? 'S' : 'AE'}</cbc:ID>
                            <cbc:Percent>${this.meta.VATPercentage.toFixed(2)}</cbc:Percent>
                            <cac:TaxScheme>
                                <cbc:ID>VAT</cbc:ID>
                            </cac:TaxScheme>
                        </cac:ClassifiedTaxCategory>
                    </cac:Item>
                    <cac:Price>
                        <cbc:PriceAmount currencyID="EUR">${(unitPrice / 100).toFixed(2)}</cbc:PriceAmount>
                    </cac:Price>
                </cac:${type}Line>`;
        }

        return `<?xml version="1.0" encoding="UTF-8"?>
                <${type} xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" xmlns="urn:oasis:names:specification:ubl:schema:xsd:${type}-2">
                    <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0</cbc:CustomizationID>
                    <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>
                    ${ubl}
                </${type}>`;
    }

    async generateUBL() {
        if (this.didSendPeppol) {
            // Can't update if already generated/sent
            return;
        }

        if (this.meta.companyVATNumber === null) {
            console.log('Skipping PEPPOL for invoice ' + this.id + ', recipient not subject to VAT')
            return;
        }

        // Check VAT number is belgian
        if (!this.meta.companyVATNumber.startsWith('BE')) {
            console.log('Skipping PEPPOL for invoice ' + this.id + ', recipient outside Belgium')
            return;
        }

        let content: string;
        try {
            content = await this.buildUBL();
        } catch (e) {
            console.error(e);
            return;
        }

        const fileId = uuidv4();

        let prefix = (STAMHOOFD.SPACES_PREFIX ?? "")
        if (prefix.length > 0) {
            prefix += "/"
        }
        const key = prefix + (STAMHOOFD.environment ?? "development") + "/invoices/" + fileId + ".xml";

        const s3 = new AWS.S3({
            endpoint: STAMHOOFD.SPACES_ENDPOINT,
            accessKeyId: STAMHOOFD.SPACES_KEY,
            secretAccessKey: STAMHOOFD.SPACES_SECRET
        });

        const buffer = Buffer.from(content, 'utf-8')

        const params = {
            Bucket: STAMHOOFD.SPACES_BUCKET,
            Key: key,
            Body: buffer,
            ContentType: 'application/xml',
            ACL: "public-read"
        };

        await s3.putObject(params).promise()

        this.meta.xml = new File({
            id: fileId,
            server: "https://"+STAMHOOFD.SPACES_BUCKET+"."+STAMHOOFD.SPACES_ENDPOINT,
            path: key,
            size: buffer.byteLength,
            name: "Invoice "+this.id
        });
        await this.save()
    }

    async sendPeppol() {
        // First try recommand
        await this.sendRecommand();

        // Other handlers
        await this.sendPeppolViaEmail();
    }

    private async sendPeppolViaEmail() {
        if (this.didSendPeppol) {
            return;
        }
        if (!STAMHOOFD.PEPPOL_EMAIL_HANDLERS) {
            console.error('PEPPOL email handlers NOT CONFIGURED')
            return;
        }

        if (this.meta.companyVATNumber === null) {
            console.log('Skipping PEPPOL for invoice ' + this.id + ', recipient not subject to VAT')
            return;
        }

        // Check VAT number is belgian
        if (!this.meta.companyVATNumber.startsWith('BE')) {
            console.log('Skipping PEPPOL for invoice ' + this.id + ', recipient outside Belgium')
            return;
        }

        if (!this.meta.xml) {
            console.log('Skipping PEPPOL for invoice ' + this.id + ', xml not set')
            return;
        }

         // Send the e-mail
        Email.send({
            // From address is fixed for sender validation
            from: '"Stamhoofd" <simon@stamhoofd.be>',
            to: STAMHOOFD.PEPPOL_EMAIL_HANDLERS.map(d => {
                return {
                    email: d
                }
            }),
            subject: "Factuur " + this.number,
            text: "Zie bijlage",
            attachments: [
                {
                    filename: this.generateFilename('xml'),
                    href: this.meta.xml.getPublicPath(),
                    contentType: "application/xml"
                }
            ]
        })

        this.didSendPeppol = true;
        await this.save();
    }

    private async sendRecommand() {
        if (this.didSendPeppol) {
            return;
        }
        if (!STAMHOOFD.RECOMMAND_COMPANY_ID || !STAMHOOFD.RECOMMAND_KEY || !STAMHOOFD.RECOMMAND_SECRET) {
            console.error('RECOMMAND NOT CONFIGURED')
            return;
        }

        if (this.meta.companyVATNumber === null) {
            console.log('Skipping PEPPOL for invoice ' + this.id + ', recipient not subject to VAT')
            return;
        }

        // Check VAT number is belgian
        if (!this.meta.companyVATNumber.startsWith('BE')) {
            console.log('Skipping PEPPOL for invoice ' + this.id + ', recipient outside Belgium')
            return;
        }

        const recipient = `0208:${this.meta.companyVATNumber.substring(2).replace(/[^0-9]+/g, '')}`

        const ubl = await this.buildUBL();
        const credentials = Buffer.from(`${STAMHOOFD.RECOMMAND_KEY}:${STAMHOOFD.RECOMMAND_SECRET}`).toString("base64");
        const body = {
            recipient,
            documentType: "xml",
            document: ubl,
            doctypeId: "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2::Invoice##urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0::2.1",
        };

        console.log('Request RECOMMAND', body);
        const response = await fetch(`https://peppol.recommand.eu/api/peppol/${encodeURIComponent(STAMHOOFD.RECOMMAND_COMPANY_ID)}/sendDocument`, {
            method: "POST",
            body: JSON.stringify(body),
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Basic ' + credentials
            }
        });

        try {
            console.log('Response RECOMMAND', await response.json());
        } catch (e) {
            console.error('Non JSON response from RECOMMAND')
        }

        if (response.status < 200 || response.status > 299) {
            // Went wrong
            console.error('Failed to send invoice via recommand')
        } else {
            this.didSendPeppol = true;
            await this.save();
        }
    }
}
