import { Migration } from '@simonbackx/simple-database';
import { STInvoice, STPendingInvoice } from '@stamhoofd/models';
import colors from "colors";

// Get prefix from filename
const prefix = __filename.replace(`${__dirname}/`, '')

/* eslint no-console: "error" */
const logger = {
    log: (...args: any[]) => {
        const message = args.map(a => a.toString()).join(" ")
        const p = colors.green(`[${prefix}]`)
        process.stdout.write(`${colors.bold(colors.dim(p))} ${message}\n`)
    },

    warn: (...args: any[]) => {
        const message = args.map(a => a.toString()).join(" ")
        const p = colors.green(`[${prefix}]`)
        process.stdout.write(`${colors.bold(colors.yellow(p))} ${message}\n`)
    },

    error: (...args: any[]) => {
        const message = args.map(a => a.toString()).join(" ")
        const p = colors.green(`[${prefix}]`)
        process.stderr.write(`${colors.bold(colors.red(p))} ${message}\n`)
    }
}

export default new Migration(async () => {
    if (STAMHOOFD.environment == "test") {
        logger.log("skipped in tests")
        return;
    }

    let lastId = ""

    while(true) {
        const invoices = await STInvoice.where({
            id: {
                sign: ">",
                value: lastId
            },
        }, {
            limit: 100,
            sort: ["id"]
        })

        if (invoices.length == 0) {
            return
        }

        lastId = invoices[invoices.length - 1].id

        for (const invoice of invoices) {
            await recheckPaid.call(invoice)
        }
    }
});

async function recheckPaid(this: STInvoice) {
    // Schule on the queue because we are modifying pending invoices
    if (this.paidAt === null) {
        return
    }
    if (!this.organizationId) {
        return;
    }

    const packages = await this.getPackages()


    const pendingInvoice = await STPendingInvoice.getForOrganization(this.organizationId)

    // Increase paid amounts and paid prices
    for (const item of this.meta.items) {
        if (item.package) {
            const pack = packages.find(p => p.id === item.package?.id)

            if (pack && pack.meta.paidAmount < item.amount) {
                logger.log('Marking package as paid', pack.id, item.price, item.amount)

                // Increase paid amount
                pack.meta.paidPrice += item.price
                pack.meta.paidAmount += item.amount
                await pack.save();

                // Also delete from pending invoice if it is there
                if (pendingInvoice) {
                    const pendingItemIndex = pendingInvoice.meta.items.findIndex(i => i.package?.id === item.package?.id)
                    if (pendingItemIndex !== -1) {
                        const pendingItem = pendingInvoice.meta.items[pendingItemIndex]
                        pendingItem.amount -= item.amount

                        if (pendingItem.amount <= 0) {
                            pendingInvoice.meta.items.splice(pendingItemIndex, 1)
                            logger.log("Removed invoice item "+pendingItem.id+" from pending invoice "+pendingInvoice.id)

                            if (pendingItem.amount < 0) {
                                logger.error("Possible multiple payments for package received", pendingItem, item, this)
                            }
                        } else {
                            logger.log("Decreased invoice item "+pendingItem.id+" from pending invoice "+pendingInvoice.id+" to "+pendingItem.amount+" items")
                        }
                    }
                }
            }
        }
    }

    if (pendingInvoice) {
        await pendingInvoice.save()
    }
}