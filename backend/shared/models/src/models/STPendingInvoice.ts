import { createMollieClient, SequenceType } from '@mollie/api-client';
import { column, ManyToOneRelation, Model } from "@simonbackx/simple-database";
import { SimpleError } from "@simonbackx/simple-errors";
import { calculateVATPercentage, PaymentMethod, PaymentStatus, STInvoiceItem, STInvoiceMeta, STPackage as STPackageStruct, STPricingType, Version } from '@stamhoofd/structures';
import { v4 as uuidv4 } from "uuid";

import { Email } from "@stamhoofd/email";
import { Formatter } from "@stamhoofd/utility";
import { InvoiceBuilder } from "../helpers/InvoiceBuilder";
import { MolliePayment, Organization, Payment, Registration, STCredit, STInvoice, STPackage } from './';

/**
 * Things that should get paid, but are not yet invoiced yet because:
 * - total price is too low
 * - auto renewals waiting for payment
 * 
 * When they are about to get paid, we create a new invoice model
 * and if that model is marked as paid, it will remove the corresponding
 * items in this pending invoice.
 * 
 * So please make sure you don't edit existing items, unless you change the id
 */
export class STPendingInvoice extends Model {
    static table = "stamhoofd_pending_invoices";

    // Columns
    @column({
        primary: true, type: "string", beforeSave(value) {
            return value ?? uuidv4();
        }
    })
    id!: string;

    @column({ foreignKey: STPendingInvoice.organization, type: "string", nullable: true })
    organizationId: string | null;
    
    @column({ type: "json", decoder: STInvoiceMeta })
    meta: STInvoiceMeta

    /// We can only have one invoice at a time for the pending invoice items
    /// So until this invoice is marked as 'failed', we don't create new invoices for this pending invoice
    @column({ type: "string", nullable: true })
    invoiceId: string | null = null

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

    static async getForOrganization(organizationId: string): Promise<STPendingInvoice | undefined> {
        const invoices = await STPendingInvoice.where({ organizationId })
        return invoices[0] ?? undefined
    }

    /**
     * Always run this in the queue!
     */
    static async addItems(organization: Organization, invoiceItems: STInvoiceItem[]): Promise<STPendingInvoice | undefined> {
        // Get the pending invoice if it exists
        let pendingInvoice = await STPendingInvoice.getForOrganization(organization.id)
        return await this.addItemsTo(pendingInvoice, organization, invoiceItems)
    }

    /**
     * Always run this in the queue!
     */
    static async addItemsTo(pendingInvoice: STPendingInvoice | undefined, organization: Organization, invoiceItems: STInvoiceItem[]): Promise<STPendingInvoice | undefined> {
        if (invoiceItems.length > 0) {
            if (!pendingInvoice) {
                // Create one
                pendingInvoice = new STPendingInvoice()
                pendingInvoice.organizationId = organization.id
                pendingInvoice.meta = STInvoiceMeta.create({
                    companyName: organization.meta.companyName ?? organization.name,
                    companyContact: organization.privateMeta.billingContact ?? "",
                    companyAddress: organization.meta.companyAddress ?? organization.address,
                    companyVATNumber: organization.meta.VATNumber,
                    VATPercentage: calculateVATPercentage(organization.meta.companyAddress ?? organization.address, organization.meta.VATNumber)
                })
            }
            pendingInvoice.meta.items.push(...invoiceItems)

            // Can we compress
            if (pendingInvoice.invoiceId === null) {
                console.log("Compressing pending invoice items "+pendingInvoice.id)
                pendingInvoice.meta.items = STInvoiceItem.compress(pendingInvoice.meta.items)
            }
            await pendingInvoice.save()
        }
        return pendingInvoice
    }

    /**
     * Always run this in the queue!
     */
    static async addAutomaticItems(organization: Organization): Promise<STPendingInvoice | undefined> {
        // Get the pending invoice if it exists
        let pendingInvoice = await STPendingInvoice.getForOrganization(organization.id)

        // Generate temporary pending invoice items for the current state without adding them IRL
        const notYetCreatedItems = await STPendingInvoice.createItems(organization.id, pendingInvoice)
        return await this.addItemsTo(pendingInvoice, organization, notYetCreatedItems)
    }

    /**
     * This method checks all the packages of the given organization and will return
     * new invoice items that should get charged. You'll need to add them to 
     * the pending invoice yourself (always in a queue!)
     */
    static async createItems(organizationId: string, pendingInvoice?: STPendingInvoice) {
        const packages = await STPackage.getForOrganization(organizationId)

        // Always use midnight as a reference time (because this method should always return the same values if it called multiple times on the same day)
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        // But use now as reference for activation detection
        const now = new Date()

        let membersCount: number | null = null
        const pendingItems: STInvoiceItem[] = []

        for (const pack of packages) {
            if (pack.meta.startDate > now) {
                continue
            }
            if (pack.meta.pricingType === STPricingType.PerMember && (pack.validUntil === null || pack.validUntil >= today)) {

                if (membersCount === null) {
                    membersCount = await Registration.getActiveMembers(organizationId)
                }

                // Calculate the items that are already pending and remove them
                const pendingCount = pendingInvoice ? pendingInvoice.meta.items.reduce((c, item) => c + ((item.package && item.package.id === pack.id) ? item.amount : 0), 0) : 0
                const item = STInvoiceItem.fromPackage(STPackageStruct.create(pack), membersCount, pendingCount, today)
                if (item.price > 0) {
                    console.log('Adding item to pending invoice', item)
                    pendingItems.push(item)
                }
            } else if ((pack.validUntil === null || pack.validUntil >= today) && pack.meta.paidAmount < pack.meta.minimumAmount) {

                // Check if paid amount matches at least one
                const pendingCount = pendingInvoice ? pendingInvoice.meta.items.reduce((c, item) => c + ((item.package && item.package.id === pack.id) ? item.amount : 0), 0) : 0
                const item = STInvoiceItem.fromPackage(STPackageStruct.create(pack), 0, pendingCount, today)
                if (item.price > 0) {
                    console.log('Adding item to pending invoice', item)
                    pendingItems.push(item)
                }
            }
        }

        // Add all payments that are not yet charged

        return pendingItems
    }

    static async charge(organization: Organization) {
        const pendingInvoice = await this.getForOrganization(organization.id)

        if (!pendingInvoice || pendingInvoice.meta.priceWithVAT === 0) {
            throw new SimpleError({
                code: "no_pending_invoice",
                message: "No pending invoice",
                human: "Je kan op dit moment niet afrekenen omdat er geen openstaand bedrag is."
            })
        }

        if (pendingInvoice.invoiceId !== null) {
            throw new SimpleError({
                code: "payment_pending",
                message: "Payment pending",
                human: "Er is momenteel al een afrekening in behandeling (dit kan 3 werkdagen duren), wacht enkele dagen voor je het opnieuw probeert."
            })
        }

        if (organization.serverMeta.mollieCustomerId === undefined) {
            throw new SimpleError({
                code: "no_mollie_customer",
                message: "No connected mollie customer",
                human: "Er is nog geen domiciliëring of automatische afrekening ingesteld"
            })
        }
        // Step 1: create the invoice
        const invoice = STInvoice.createFor(organization)

        invoice.meta.items = pendingInvoice.meta.items.slice() // make a copy (needed to prevent mutating pending invoice and invoice at the same time)

        if (invoice.meta.priceWithVAT == 0) {
            throw new SimpleError({
                code: "no_pending_invoice",
                message: "No pending invoice",
                human: "Je kan op dit moment niet afrekenen omdat er geen openstaand bedrag is."
            })
        }

        await STCredit.applyCredits(organization.id, invoice, false)

        const price = invoice.meta.priceWithVAT
        
         // Create payment
        const payment = new Payment()
        payment.organizationId = null
        payment.method = PaymentMethod.DirectDebit
        payment.status = PaymentStatus.Created
        payment.price = price
        payment.paidAt = null
        await payment.save()
        invoice.paymentId = payment.id
        invoice.setRelation(STInvoice.payment, payment)
        await invoice.save()

        const description = "Stamhoofd - "+invoice.id

        if (price <= 0) {
            // Needs to happen before markPaid! (because the pending invoice will get modified)
            pendingInvoice.invoiceId = invoice.id
            await pendingInvoice.save()

            await invoice.markPaid()
        } else {
            // Mollie payment is required
            const apiKey = STAMHOOFD.MOLLIE_API_KEY
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
                //method: molliePaymentMethod.directdebit,
                description,
                customerId: organization.serverMeta.mollieCustomerId,
                sequenceType: SequenceType.recurring,
                redirectUrl: "https://"+STAMHOOFD.domains.dashboard+'/settings/billing/payment?id='+encodeURIComponent(payment.id),
                webhookUrl: 'https://'+STAMHOOFD.domains.api+"/v"+Version+"/billing/payments/"+encodeURIComponent(payment.id)+"?exchange=true",
                metadata: {
                    invoiceId: invoice.id,
                    paymentId: payment.id,
                }
            });
            console.log(molliePayment)
            if (molliePayment.method === 'creditcard') {
                console.log("Corrected payment method to creditcard")
                payment.method = PaymentMethod.CreditCard
                await payment.save();
            }

            // Save payment
            const dbPayment = new MolliePayment()
            dbPayment.paymentId = payment.id
            dbPayment.mollieId = molliePayment.id
            await dbPayment.save();

            // Only if all went okay
            pendingInvoice.invoiceId = invoice.id
            await pendingInvoice.save()

            const invoicingTo = await organization.getInvoicingToEmails()

            if (invoicingTo && payment.method === PaymentMethod.DirectDebit) {
                // Generate a temporary PDF file
                const builder = new InvoiceBuilder(invoice)
                const pdf = await builder.build()

                // Send the e-mail
                Email.sendInternal({
                    to: invoicingTo,
                    bcc: "simon@stamhoofd.be",
                    subject: "Pro-forma factuur voor "+organization.name,
                    text: "Dag "+organization.name+", \n\nBedankt voor jullie vertrouwen in Stamhoofd. Jullie hebben momenteel een openstaand bedrag van "+Formatter.price(price)+" in Stamhoofd (zie bijlage). Zoals eerder aangegeven zal dit via domiciliëring worden aangerekend (op dezelfde bankrekening waarmee de vorige betaling is gedaan). Hiervoor hoeven jullie dus niets te doen. Kijk eventueel na of er voldoende geld op jullie rekening staat. De betaling zal één van de komende drie werkdagen plaatsvinden. Jullie ontvangen daarna ook een definitieve factuur. Je kan in Stamhoofd altijd het openstaande bedrag nakijken bij Instellingen > Facturen en betalingen. Neem gerust contact met ons op (via hallo@stamhoofd.be) als je denkt dat er iets fout is gegaan of als je nog bijkomende vragen zou hebben.\n\nMet vriendelijke groeten,\nStamhoofd\n\n",
                    attachments: [
                        {
                            filename: "pro-forma-factuur.pdf",
                            href: pdf.getPublicPath(),
                            contentType: "application/pdf"
                        }
                    ]
                }, organization.i18n)
            }
        }
    }
}
