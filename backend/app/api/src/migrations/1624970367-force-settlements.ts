import { Migration } from '@simonbackx/simple-database';

import { checkSettlements } from '../helpers/CheckSettlements';

export default new Migration(async () => {
    if (process.env.NODE_ENV == "test") {
        console.log("skipped in tests")
        return;
    }

    await checkSettlements(true)
});


