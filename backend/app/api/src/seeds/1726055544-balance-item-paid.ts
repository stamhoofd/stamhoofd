import { Migration } from '@simonbackx/simple-database';
import { BalanceItem } from '@stamhoofd/models';

export default new Migration(async () => {
    if (STAMHOOFD.environment == "test") {
        console.log("skipped in tests")
        return;
    }

    await BalanceItem.updatePricePaid('all')
})
