import { column, ManyToOneRelation, Model } from "@simonbackx/simple-database";
import { STInvoiceItem, STInvoiceMeta, STPackage as STPackageStruct,STPricingType } from '@stamhoofd/structures';
import { v4 as uuidv4 } from "uuid";

import { Organization } from './Organization';
import { Registration } from "./Registration";
import { STPackage } from "./STPackage";

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

    @column({ foreignKey: STPendingInvoice.organization, type: "string" })
    organizationId: string;
    
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
        }
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
    static async addItems(organization: Organization): Promise<STPendingInvoice | undefined> {
        // Get the pending invoice if it exists
        let pendingInvoice = await STPendingInvoice.getForOrganization(organization.id)

        // Generate temporary pending invoice items for the current state without adding them IRL
        const notYetCreatedItems = await STPendingInvoice.createItems(organization.id, pendingInvoice)

        if (notYetCreatedItems) {
            if (!pendingInvoice) {
                // Create one
                pendingInvoice = new STPendingInvoice()
                pendingInvoice.organizationId = organization.id
                pendingInvoice.meta = STInvoiceMeta.create({
                    companyName: organization.name,
                    companyAddress: organization.address,
                    companyVATNumber: organization.privateMeta.VATNumber
                })
            }
            pendingInvoice.meta.items.push(...notYetCreatedItems)
            await pendingInvoice.save()
        }
        return pendingInvoice
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
                    pendingItems.push(item)
                }
            } else if ((pack.validUntil === null || pack.validUntil >= today) && pack.meta.paidAmount < pack.meta.minimumAmount) {

                // Check if paid amount matches at least one
                const pendingCount = pendingInvoice ? pendingInvoice.meta.items.reduce((c, item) => c + ((item.package && item.package.id === pack.id) ? item.amount : 0), 0) : 0
                const item = STInvoiceItem.fromPackage(STPackageStruct.create(pack), 0, pendingCount, today)
                console.log(item)
                if (item.price > 0) {
                    pendingItems.push(item)
                }
            }
        }

        return pendingItems
    }
}
