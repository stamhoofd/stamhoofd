import { Migration } from '@simonbackx/simple-database';

export default new Migration(async () => {
    if (STAMHOOFD.environment == "test") {
        console.log("skipped in tests")
        return;
    }

    // Do something here
    return Promise.resolve()
});


