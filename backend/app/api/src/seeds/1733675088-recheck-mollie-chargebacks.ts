import { Migration } from '@simonbackx/simple-database';

import { doCheckMollieChargebacks } from '../new-crons/checkMollieChargebacks';

export default new Migration(async () => {
    if (STAMHOOFD.environment == "test") {
        console.log("skipped in tests")
        return;
    }

    await doCheckMollieChargebacks(true)
});