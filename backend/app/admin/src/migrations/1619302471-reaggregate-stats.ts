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

    const startDate = new Date("2021-05-01")
    startDate.setDate(1)
    startDate.setMonth(4) // month - 1!
    startDate.setFullYear(2021)
    startDate.setHours(0, 0, 0, 0)

    while (startDate < today) {
        console.log(Formatter.date(startDate))
    
        const aggregation = await Statistic.createAggregation(startDate)

        const end = new Date(startDate)
        end.setDate(end.getDate() + 1)
        end.setHours(0, 0, 0, 0)

        for (const organization of organizations) {
            // Recalculate wrong data
            const stat = await Statistic.buildFor(organization.id, startDate)
            aggregation.add(stat)
        }

        await aggregation.save()

        // Next day
        startDate.setDate(startDate.getDate() + 1)
        startDate.setHours(0, 0, 0, 0)
    }
});


