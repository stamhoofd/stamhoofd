import { Migration } from '@simonbackx/simple-database';
import { Member } from '@stamhoofd/models';

export default new Migration(async () => {
    if (STAMHOOFD.environment == "test") {
        console.log("skipped in tests")
        return;
    }

    if(STAMHOOFD.userMode !== "platform") {
        console.log("skipped seed update-membership because usermode not platform")
        return;
    }

    process.stdout.write('\n');
    let c = 0;
    let id: string = '';

    while(true) {
        const rawMembers = await Member.where({
            id: {
                value: id,
                sign: '>'
            }
        }, {limit: 500, sort: ['id']});

        if (rawMembers.length === 0) {
            break;
        }

        const promises: Promise<any>[] = [];
        

        for (const member of rawMembers) {
            promises.push((async () => {
                await Member.updateMembershipsForId(member.id, true);
                c++;
    
                if (c%1000 === 0) {
                    process.stdout.write('.');
                }
                if (c%10000 === 0) {
                    process.stdout.write('\n');
                }
            })())
        }

        await Promise.all(promises);
        id = rawMembers[rawMembers.length - 1].id;
    }

    // Do something here
    return Promise.resolve()
})
