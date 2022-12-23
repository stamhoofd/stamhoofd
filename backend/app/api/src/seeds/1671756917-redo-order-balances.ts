import { Migration } from '@simonbackx/simple-database';
import { BalanceItem, BalanceItemPayment, Order, Payment, Webshop } from '@stamhoofd/models';
import { BalanceItemStatus, OrderStatus, PaymentStatus } from '@stamhoofd/structures';

// This migration recreates balance items for manually created orders that didn't had them added

const webshopCache = new Map<string, string>()

const avgTotal = 160810
let lastPercentage = 0
let counted = 0

function doCount() {
    counted++
    const percentage = Math.round(counted / avgTotal * 100)
    if (percentage !== lastPercentage) {
        lastPercentage = percentage
        console.log(percentage+"%")
    }
}

async function processOrders(orders: Order[]) {
    for (const order of orders) {
        doCount();
        if (!order.paymentId) {
            continue;
        }

        const balanceItems = await BalanceItemPayment.where({ paymentId: order.paymentId }, { limit: 1 })
        if (balanceItems.length > 0) {
            continue;
        }

        const payment = await Payment.getByID(order.paymentId)
        const webshopName =  webshopCache.get(order.webshopId) ?? ((await Webshop.getByID(order.webshopId))?.meta?.name)

        if (!payment || !webshopName) {
            continue;
        }

        webshopCache.set(order.webshopId, webshopName)

        // Create balance item
        const balanceItem = new BalanceItem();
        balanceItem.price = payment.price
        balanceItem.orderId = order.id;

        if (order.number) {
            balanceItem.description = 'Bestelling #' + order.number?.toString() + ' - ' + webshopName
        } else {
            balanceItem.description = 'Bestelling ' + webshopName
        }

        balanceItem.pricePaid = payment.status == PaymentStatus.Succeeded ? payment.price : 0;
        balanceItem.organizationId = order.organizationId;
        balanceItem.status = payment.status == PaymentStatus.Succeeded ? BalanceItemStatus.Paid : (order.number !== null && order.status !== OrderStatus.Deleted ? BalanceItemStatus.Pending : BalanceItemStatus.Hidden);
        balanceItem.createdAt = payment.createdAt
        await balanceItem.save();

        // Create one balance item payment to pay it in one payment
        const balanceItemPayment = new BalanceItemPayment()
        balanceItemPayment.balanceItemId = balanceItem.id;
        balanceItemPayment.paymentId = payment.id;
        balanceItemPayment.organizationId = order.organizationId;
        balanceItemPayment.price = balanceItem.price;
        await balanceItemPayment.save();

        console.log('Corrected order '+order.id)
    }
}

export default new Migration(async () => {
    if (STAMHOOFD.environment == "test") {
        console.log("skipped in tests")
        return;
    }


    let lastId = ""
    let orders = await Order.where({
        id: {
            sign: ">",
            value: lastId
        }
    }, {
        limit: 50,
        sort: ["id"]
    })

    // eslint-disable-next-line no-constant-condition
    while (true) {
        if (orders.length == 0) {
            break;
        }

        lastId = orders[orders.length - 1].id
        await processOrders(orders)
        
        orders = await Order.where({
            id: {
                sign: ">",
                value: lastId
            }
        }, {
            limit: 50,
            sort: ["id"]
        })
    }
});


