import { Migration } from '@simonbackx/simple-database';
import { logger } from '@simonbackx/simple-logging';
import { BalanceItem } from '@stamhoofd/models';

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
            const items = await BalanceItem.where({
                id: {
                    value: id,
                    sign: '>'
                }
            }, {limit: 1000, sort: ['id']});

            await BalanceItem.updateOutstanding(items)

            c += items.length;
            process.stdout.write('.');

            if (items.length < 1000) {
                break;
            }
            id = items[items.length - 1].id;
        }
    })

    console.log("Updated outstanding balance for " + c + " items")

    // Do something here
    return Promise.resolve()
})
