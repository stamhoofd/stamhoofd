import { Migration } from '@simonbackx/simple-database';

import { checkAllStripePayouts } from '../helpers/CheckSettlements';

export default new Migration(async () => {
    if (STAMHOOFD.environment == "test") {
        console.log("skipped in tests")
        return;
    }

    await checkAllStripePayouts(true)
});


