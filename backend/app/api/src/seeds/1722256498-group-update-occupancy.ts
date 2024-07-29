import { Migration } from '@simonbackx/simple-database';
import { Group } from '@stamhoofd/models';

export default new Migration(async () => {
    if (STAMHOOFD.environment == "test") {
        console.log("skipped in tests")
        return;
    }

    if(STAMHOOFD.userMode !== "platform") {
        console.log("skipped seed group-update-occupancy because usermode not platform")
        return;
    }

    process.stdout.write('\n');
    let c = 0;
    let id: string = '';

    while(true) {
        const rawGroups = await Group.where({
            id: {
                value: id,
                sign: '>'
            }
        }, {limit: 100, sort: ['id']});

        const groups = await Group.getByIDs(...rawGroups.map(g => g.id));

        for (const group of groups) {
            await group.updateOccupancy();
            await group.save();

            c++;

            if (c%1000 === 0) {
                process.stdout.write('.');
            }
            if (c%10000 === 0) {
                process.stdout.write('\n');
            }
        }

        if (groups.length === 0) {
            break;
        }

        id = groups[groups.length - 1].id;
    }

    // Do something here
    return Promise.resolve()
})
