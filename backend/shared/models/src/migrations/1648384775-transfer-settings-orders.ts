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
    let shopBuffer = new Map<string, Webshop>()

    while(true) {
        const orders = await Order.where({ id: { sign: '>', value: lastId }, paymentId: { sign: '!=', value: null}, validAt: { sign: '!=', value: null} }, {
            limit: 500,
            sort: ["id"]
        })
        process.stdout.write(".")

        if (orders.length == 0) {
            break
        }

        const paymentIds = Formatter.uniqueArray(orders.flatMap(o => o.paymentId ? [o.paymentId] : []))
        const payments = await Payment.getByIDs(...paymentIds)

        const webshopIds = Formatter.uniqueArray(orders.flatMap(o => o.webshopId ? [o.webshopId] : []))
        const webshops = await Webshop.getByIDs(...webshopIds)

        const organizationIds = Formatter.uniqueArray(orders.flatMap(o => o.organizationId ? [o.organizationId] : []))
        const organizations = await Organization.getByIDs(...organizationIds)

        const writePromises: Promise<boolean>[] = []
        for (const order of orders) {
            if (!order.paymentId) {
                continue
            }
            const payment = payments.find(p => p.id === order.paymentId)
            if (payment) {
                const webshop = webshops.find(w => w.id === order.webshopId)
                const organization = organizations.find(o => o.id === order.organizationId)

                if (webshop && organization) {
                    payment.transferSettings = webshop.meta.transferSettings.fillMissing(organization.meta.transferSettings)
                    writePromises.push(payment.save())
                }
            }
        }
        await Promise.all(writePromises)

        lastId = orders[orders.length - 1].id
    }
    process.stdout.write("\nDone.\n")
});


