import { Migration } from '@simonbackx/simple-database';
import { logger } from '@simonbackx/simple-logging';
import { BalanceItem, BalanceItemPayment, Payment } from '@stamhoofd/models';

export default new Migration(async () => {
    if (STAMHOOFD.environment == "test") {
        console.log("skipped in tests")
        return;
    }

    process.stdout.write('\n');
    let c = 0;
    let id: string = '';

    await logger.setContext({tags: ['silent-seed', 'seed']}, async () => {
        while(true) {
            const payments = await Payment.where({
                id: {
                    value: id,
                    sign: '>'
                }
            }, {limit: 100, sort: ['id']});

            for (const payment of payments) {
                const unloaded = (await BalanceItemPayment.where({paymentId: payment.id})).map(r => r.setRelation(BalanceItemPayment.payment, payment))
                const balanceItemPayments = await BalanceItemPayment.balanceItem.load(
                    unloaded
                );

                await BalanceItem.updateOutstanding(balanceItemPayments.map(p => p.balanceItem))

                c++;

                if (c%100 === 0) {
                    process.stdout.write('.');
                }
                if (c%10000 === 0) {
                    process.stdout.write('\n');
                }
            }

            if (payments.length < 100) {
                break;
            }
            id = payments[payments.length - 1].id;
        }
    })

    console.log("Updated outstanding balance for " + c + " payments")

    // Do something here
    return Promise.resolve()
})
