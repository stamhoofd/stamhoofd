import { column, ManyToOneRelation, Model } from "@simonbackx/simple-database";
import { STCredit as STCreditStruct, calculateVATPercentage, Payment as PaymentStruct, STBillingStatus, STInvoice as STInvoiceStruct,STInvoiceItem, STInvoiceMeta, STPackage as STPackageStruct, STPendingInvoice as STPendingInvoiceStruct, User, PaymentMethod, STPackageType } from '@stamhoofd/structures';
import { v4 as uuidv4 } from "uuid";

import { QueueHandler } from "@stamhoofd/queues";
import { Organization } from './Organization';
import { Payment } from "./Payment";
import { STPackage } from "./STPackage";
import { STPendingInvoice } from "./STPendingInvoice";
import { InvoiceBuilder } from "../helpers/InvoiceBuilder";
import { Sorter } from "@stamhoofd/utility";
import { STCredit } from "./STCredit";
import { Email } from "@stamhoofd/email";
import { UsedRegisterCode } from "./UsedRegisterCode";


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

    static organization = new ManyToOneRelation(Organization, "organization");
    static payment = new ManyToOneRelation(Payment, "payment");

    static createFor(organization: Organization): STInvoice {
        const invoice = new STInvoice()
        invoice.organizationId = organization.id
        
        const date = new Date()
        invoice.meta = STInvoiceMeta.create({
            date,
            companyName: organization.name,
            companyContact: organization.privateMeta.billingContact ?? "",
            companyAddress: organization.address,
            companyVATNumber: organization.privateMeta.VATNumber,
            VATPercentage: calculateVATPercentage(organization.address, organization.privateMeta.VATNumber)
        })

        return invoice
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

        console.warn("No connected packages to invoice "+this.id)

        return []
    }

    /**
     * WARNING: only call this in the correct queue!
     */
    async markPaid() {
        // Schule on the queue because we are modifying pending invoices
        if (this.paidAt !== null) {
            return
        }

        this.paidAt = new Date()

        if (this.meta.priceWithoutVAT > 0) {
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
                    pack.meta.paidAmount += item.amount
                }
            }
        }

        // Search for all packages and activate them if needed (might be possible that they are already validated)
        for (const pack of packages) {
            console.log("Activating package "+pack.id)

            // We'll never have multiple invoices for the same package that are awaiting payments
            pack.meta.firstFailedPayment = null;
            pack.meta.paymentFailedCount = 0;

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
                        console.log("Removed invoice item "+item.id+" from pending invoice "+pendingInvoice.id)
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

        if (this.organizationId && this.meta.pdf && this.number !== null) {
            const organization = await Organization.getByID(this.organizationId)
            if (organization) {
                const invoicingTo = await organization.getInvoicingToEmails()

                if (invoicingTo) {
                    // Send the e-mail
                    Email.sendInternal({
                        to: invoicingTo,
                        bcc: "simon@stamhoofd.be",
                        subject: "Jouw factuur voor "+organization.name,
                        text: "Dag "+organization.name+", \n\nBedankt voor jullie vertrouwen in Stamhoofd. In bijlage vinden jullie de factuur van jullie aankoop. Neem gerust contact met ons op (via hallo@stamhoofd.be) als je denkt dat er iets fout is gegaan of als je nog bijkomende vragen zou hebben.\n\nMet vriendelijke groeten,\nStamhoofd\n\n",
                        attachments: [
                            {
                                filename: "factuur-"+this.number+".pdf",
                                href: this.meta.pdf.getPublicPath(),
                                contentType: "application/pdf"
                            }
                        ]
                    })
                }
            }
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

    async assignNextNumber() {
        return await QueueHandler.schedule("billing/invoice-numbers", async () => {
            // Get clone
            const refreshed = await STInvoice.getByID(this.id)
            if (!refreshed || refreshed.number !== null) {
                return
            }
            if (STInvoice.numberCache) {
                this.number = STInvoice.numberCache + 1
                await this.save()

                // If save succeeded: increase it
                STInvoice.numberCache++;
                return
            }
            const lastInvoice = await STInvoice.where({ number: { value: null, sign: "!=" }}, { sort: [{ column: "number", direction: "DESC"}], limit: 1 })
            STInvoice.numberCache = lastInvoice[0]?.number ?? 0
            
            this.number = STInvoice.numberCache + 1
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
    async markFailed(payment: Payment) {
        console.log("Mark invoice as failed", this.id)

        const packages = await this.getPackages()

        if (payment.method === PaymentMethod.DirectDebit) {
            // Only mark failed payments for background payments
            for (const pack of packages) {
                console.log("Marking package with failed payment "+pack.id)

                pack.meta.firstFailedPayment = pack.meta.firstFailedPayment ?? new Date()
                pack.meta.paymentFailedCount++;
                await pack.save()

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

        if (this.creditId !== null) {
            const credit = await STCredit.getByID(this.creditId)
            if (credit && (credit.expireAt === null || credit.expireAt > new Date())) {
                // Expire usage (do not delete to keep the relation for debugging and recovery)
                credit.expireAt = new Date(new Date().getTime() - 1000);
                await credit.save()
            }
        }

        if (this.organizationId && payment.method === PaymentMethod.DirectDebit) {
            const organization = await Organization.getByID(this.organizationId)
            if (organization) {
                const invoicingTo = await organization.getInvoicingToEmails()

                if (invoicingTo) {
                    // Send the e-mail
                    Email.sendInternal({
                        to: invoicingTo,
                        bcc: "simon@stamhoofd.be",
                        subject: "Betaling mislukt voor "+organization.name,
                        text: "Dag "+organization.name+", \n\nDe automatische betaling via domiciliëring van jullie openstaande bedrag is mislukt (zie daarvoor onze vorige e-mail). Kijk even na wat er fout ging en betaal het openstaande bedrag manueel om te vermijden dat bepaalde diensten tijdelijk worden uitgeschakeld. Betalen kan via Stamhoofd > Instellingen > Facturen en betalingen > Openstaand bedrag > Afrekenen. Neem gerust contact met ons op als je bijkomende vragen hebt.\n\nMet vriendelijke groeten,\nStamhoofd\n\n",
                    })
                }
            }
        }
    }


    static async getBillingStatus(organization: Organization): Promise<STBillingStatus> {
        // Get all packages
        const packages = await STPackage.getForOrganization(organization.id)

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
                companyName: organization.name,
                companyContact: organization.privateMeta.billingContact ?? "",
                companyAddress: organization.address,
                companyVATNumber: organization.privateMeta.VATNumber,
                VATPercentage: calculateVATPercentage(organization.address, organization.privateMeta.VATNumber)
            })
        }) : null)
        
        if (notYetCreatedItems.length > 0 && pendingInvoiceStruct) {
            pendingInvoiceStruct.meta.items.push(...notYetCreatedItems)
        }

        if (pendingInvoiceStruct) {
            // Compress
            pendingInvoiceStruct!.meta.items = STInvoiceItem.compress(pendingInvoiceStruct!.meta.items)
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
            credits: credits.map(c => STCreditStruct.create(c))
        });
    }
}
