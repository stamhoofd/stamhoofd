import { column, Model } from "@simonbackx/simple-database";
import { STInvoiceItem } from "@stamhoofd/structures";
import { v4 as uuidv4 } from "uuid";
import { STInvoice } from "./STInvoice";

export class STCredit extends Model {
    static table = "stamhoofd_credits";

    // Columns
    @column({
        primary: true, type: "string", beforeSave(value) {
            return value ?? uuidv4();
        }
    })
    id!: string;

    @column({ type: "string" })
    organizationId: string;

    @column({ type: "string" })
    description: string;

    @column({ type: "integer" })
    change: number;

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

    @column({ type: "datetime", nullable: true })
    expireAt: Date | null = null

    @column({
        type: "datetime", beforeSave() {
            const date = new Date()
            date.setMilliseconds(0)
            return date
        },
        skipUpdate: true
    })
    updatedAt: Date

    static async getForOrganization(organizationId: string) {
        return await STCredit.where({ organizationId }, { 
            sort: [{
                column: "createdAt",
                direction: "DESC"
            }]
        })
    }

    static async getBalance(organizationId: string) {
        const now = new Date()
        const credits = await this.getForOrganization(organizationId)
        credits.reverse()
        let balance = 0
        for (const credit of credits) {
            if (credit.expireAt !== null && credit.expireAt <= now) {
                continue
            }
            // Todo: we can expire credits here
            balance += credit.change
            if (balance < 0) {
                // This is needed to make deleting credit and expiring credit work.
                // At no point in time, the credits can get negative.
                // E.g. Getting credits, using them, and later expiring 'getting the credits' won't have impact on future credits
                balance = 0
            }
        }
        return balance
    }

    static async applyCredits(organizationId, invoice: STInvoice, dryRun: boolean) {
        // Apply credits
        const balance = await STCredit.getBalance(organizationId)
        if (balance > 0) {
            const applyValue = Math.min(invoice.meta.priceWithoutVAT, balance)
            invoice.meta.items.push(STInvoiceItem.create({
                name: "Gebruikt tegoed",
                unitPrice: -applyValue,
                amount: 1,
                date: new Date()
            }))

            if (!dryRun) {
                const credit = new STCredit()
                credit.organizationId = organizationId
                credit.change = -applyValue
                credit.description = "Tijdelijk vrijgehouden voor lopende betaling"

                // Reserve for one week (direct debit can take a while)
                credit.expireAt = new Date()
                credit.expireAt.setDate(credit.expireAt.getDate() + 7)
                credit.expireAt.setMilliseconds(0)

                await credit.save()
                invoice.creditId = credit.id
            }
        }
    }
}
