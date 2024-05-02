import { Migration } from '@simonbackx/simple-database';
import { Organization } from '@stamhoofd/models';
import { Formatter } from '@stamhoofd/utility';

import { Statistic } from '../models/Statistic';

export default new Migration(async () => {
    if (STAMHOOFD.environment == "test") {
        console.log("skipped in tests")
        return;
    }

    const organizations = await Organization.all();

    const today = new Date()

    const startDate = new Date("2020-08-01")
    startDate.setDate(1)
    startDate.setMonth(7) // month - 1!
    startDate.setFullYear(2020)
    startDate.setHours(0, 0, 0, 0)

    while (startDate < today) {
        console.log(Formatter.date(startDate))

        const aggregation = await Statistic.createAggregation(startDate)

        for (const organization of organizations) {
            const stat = await Statistic.buildFor(organization.id, startDate)
            aggregation.add(stat)
        }

        await aggregation.save()

        // Next day
        startDate.setDate(startDate.getDate() + 1)
        startDate.setHours(0, 0, 0, 0)
    }
});


