import { Migration } from '@simonbackx/simple-database';
import { Organization } from '@stamhoofd/models';
import { QueueHandler } from '@stamhoofd/queues';
import { Formatter } from '@stamhoofd/utility';

import { Statistic } from '../models/Statistic';

export default new Migration(async () => {
    if (STAMHOOFD.environment == "test") {
        console.log("skipped in tests")
        return;
    }

    const organizations = await Organization.all();

    const today = Formatter.luxon().set({ hour: 0, minute: 0, second: 0, millisecond: 0 }).toJSDate()

    let startDate = Formatter.luxon(new Date("2021-05-01"))
    startDate = startDate.set({ day: 1, month: 8, year: 2020, hour: 0, minute: 0, second: 0, millisecond: 0 })

    while (startDate.toJSDate() < today) {
        const jsDate = startDate.toJSDate();

        QueueHandler.schedule("migration", async () => {
            console.log(Formatter.dateIso(jsDate))

            for (const organization of organizations) {
                await Statistic.buildFor(organization.id, jsDate, true)
            }

            await Statistic.updateAggregation(jsDate);

        }, 25).catch(console.error);

        startDate = startDate.plus({ days: 1 })
    }

    await QueueHandler.schedule("migration", async () => {
        console.log("Done")
        return Promise.resolve()
    }, 25);
});


