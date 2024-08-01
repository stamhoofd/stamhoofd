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
        }, {limit: 100, sort: ['id']});

        // const members = await Member.getByIDs(...rawMembers.map(m => m.id));

        for (const member of rawMembers) {
            const memberWithRegistrations = await Member.getWithRegistrations(member.id);
            if(memberWithRegistrations) {
                await memberWithRegistrations.updateMemberships();
                await memberWithRegistrations.save();
            } else {
                throw new Error("Member with registrations not found: " + member.id);
            }

            c++;

            if (c%1000 === 0) {
                process.stdout.write('.');
            }
            if (c%10000 === 0) {
                process.stdout.write('\n');
            }
        }

        if (rawMembers.length === 0) {
            break;
        }

        id = rawMembers[rawMembers.length - 1].id;
    }

    // Do something here
    return Promise.resolve()
})
