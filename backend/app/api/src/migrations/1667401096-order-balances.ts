import { Database, Migration } from '@simonbackx/simple-database';
import { BalanceItem, BalanceItemPayment, Order, Payment, Webshop } from '@stamhoofd/models';
import { BalanceItemStatus, OrderStatus, PaymentMethod, PaymentStatus } from '@stamhoofd/structures';

const webshopCache = new Map<string, Webshop>()

const avgTotal = 150000
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
        const payment = await Payment.getByID(order.paymentId)
        const webshop =  webshopCache.get(order.webshopId) ?? await Webshop.getByID(order.webshopId)

        if (!payment || !webshop) {
            continue;
        }

        if (order.status === OrderStatus.Canceled || order.status === OrderStatus.Deleted) {
            if (payment.method === PaymentMethod.PointOfSale || payment.method === PaymentMethod.Transfer) {
                if (payment.status == PaymentStatus.Created || payment.status == PaymentStatus.Pending) {
                    payment.status = PaymentStatus.Failed
                    payment._forceUpdatedAt = order.status === OrderStatus.Deleted ? new Date(1900, 0, 1) : order.createdAt
                    await payment.save()
                }
            }
        }

        if (!payment.organizationId) {
            payment.organizationId = order.organizationId;
            await payment.save()
        }

        webshopCache.set(order.webshopId, webshop)

        // Create balance item
        const balanceItem = new BalanceItem();
        balanceItem.price = payment.price
        balanceItem.orderId = order.id;

        if (order.number) {
            balanceItem.description = 'Bestelling #' + order.number?.toString() + ' - ' + webshop.meta.name
        } else {
            balanceItem.description = 'Bestelling ' + webshop.meta.name
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
    }
}

export default new Migration(async () => {
    if (STAMHOOFD.environment == "test") {
        console.log("skipped in tests")
        return;
    }

    // Delete all balance items
    await Database.delete("DELETE FROM `balance_items` where orderId is not null");

    let lastId = ""
    let orders = await Order.where({
        id: {
            sign: ">",
            value: lastId
        }
    }, {
        limit: 200,
        sort: ["id"]
    })

    // eslint-disable-next-line no-constant-condition
    while (true) {
        if (orders.length == 0) {
            break;
        }

        lastId = orders[orders.length - 1].id

        const batches: Order[][] = []
        for (let i = 0; i < orders.length; i += 50) {
            batches.push(orders.slice(i, i + 50))
        }
        
        // Process batches in parallel
        await Promise.all([
            ...batches.map(batch => processOrders(batch)),
            (async () => {
                // Fetch the next registrations in parallel
                orders = await Order.where({
                    id: {
                        sign: ">",
                        value: lastId
                    }
                }, {
                    limit: 1600,
                    sort: ["id"]
                })
            })()
        ])
    }
});


