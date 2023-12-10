import { column, Model } from "@simonbackx/simple-database";
import { STInvoiceItem } from "@stamhoofd/structures";
import { v4 as uuidv4 } from "uuid";

import { STInvoice } from "./";

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

    @column({ type: "boolean" })
    allowTransactions = false

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
        let balanceTransactions = 0

        for (const credit of credits) {
            if (credit.expireAt !== null && credit.expireAt <= now) {
                continue
            }
            // TODO: we can expire credits here
            balance += credit.change
            if (balance < 0) {
                // This is needed to make deleting credit and expiring credit work.
                // At no point in time, the credits can get negative.
                // E.g. Getting credits, using them, and later expiring 'getting the credits' won't have impact on future credits
                balance = 0
            }

            if (credit.allowTransactions || credit.change < 0) {
                balanceTransactions += credit.change

                // No point in time we can have more balance for transactions
                balanceTransactions = Math.min(Math.max(balanceTransactions, 0), balance)
            }
        }

        return {balance: balance - balanceTransactions, balanceTransactions}
    }

    static async applyCredits(organizationId: string, invoice: STInvoice, dryRun: boolean) {
        // Apply credits
        const {balance, balanceTransactions} = await STCredit.getBalance(organizationId)
        if (balance > 0 || balanceTransactions > 0) {
            // Loop all items where you can use credits for
            const maxCredits = invoice.meta.items.filter(i => i.canUseCredits).reduce((price, item) => price + item.price, 0)
            let applyValue = Math.min(maxCredits, balance)

            if (balanceTransactions > 0) {
                // Can apply to all items
                const maxTransactionsCredits = invoice.meta.items.reduce((price, item) => price + item.price, 0) - applyValue
                applyValue += Math.min(maxTransactionsCredits, balanceTransactions)
            }

            if (applyValue > 0) {
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
}
