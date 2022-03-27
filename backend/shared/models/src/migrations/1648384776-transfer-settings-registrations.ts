import { Migration } from '@simonbackx/simple-database';
import { Formatter } from '@stamhoofd/utility';
import { Order } from '../models/Order';
import { Organization } from '../models/Organization';
import { Payment } from '../models/Payment';
import { Webshop } from '../models/Webshop';

/**
 * Set the reservedAmount for all orders if they were included in the stock
 */
export default new Migration(async () => {
    if (STAMHOOFD.environment == "test") {
        console.log("skipped in tests")
        return;
    }

    let lastId = ""

    while(true) {
        const payments = await Payment.where({ id: { sign: '>', value: lastId }, transferSettings: { sign: '=', value: null}, transferDescription: { sign: '!=', value: null} }, {
            limit: 500,
            sort: ["id"]
        })
        process.stdout.write(".")

        if (payments.length == 0) {
            break
        }

        const organizationIds = Formatter.uniqueArray(payments.flatMap(o => o.organizationId ? [o.organizationId] : []))
        const organizations = await Organization.getByIDs(...organizationIds)

        const writePromises: Promise<boolean>[] = []
        for (const payment of payments) {
            const organization = organizations.find(o => o.id == payment.organizationId)
            if (organization) {
                payment.transferSettings = organization.meta.transferSettings
                writePromises.push(payment.save())
            }
        }
        await Promise.all(writePromises)

        lastId = payments[payments.length - 1].id
    }
    process.stdout.write("\nDone.\n")
});


