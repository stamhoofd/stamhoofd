import { Migration } from '@simonbackx/simple-database';
import { Member, Registration } from '@stamhoofd/models';

export default new Migration(async () => {
    process.stdout.write('\n');
    for await (const member of Member.select().all()) {
        member.forceSaveProperty('details');
        await member.save();
    }

    for await (const registration of Registration.select().all()) {
        registration.forceSaveProperty('groupPrice');
        await registration.save();
    }
});
