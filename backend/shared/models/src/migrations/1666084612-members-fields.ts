import { Migration } from '@simonbackx/simple-database';

import { Member } from '../models';

export default new Migration(async () => {
    if (STAMHOOFD.environment == "test") {
        console.log("skipped in tests")
        return;
    }

    // Start to loop all members
    let lastId = "";

    while(true) {
        const members = await Member.where({id: {sign: '>', value: lastId}}, {limit: 1000, sort: ["id"]});

        if (members.length == 0) {
            break;
        }

        for (const member of members) {
            member.markAllChanged()
            await member.save();
        }
        lastId = members[members.length - 1].id
    }
});