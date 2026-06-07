import { Migration } from '@simonbackx/simple-database';
import { Member } from '@stamhoofd/models';
import { SeedTools } from '../helpers/SeedTools.js';

export default new Migration(async () => {
    process.stdout.write('\n');

    await migrateMembers();
});

async function migrateMembers() {
    console.log('Start updating members.');

    let realUpdate = 0;
    const result = await SeedTools.loop({
        query: Member.select().where('updatedAt', '<', new Date(Date.now() - 1_000 * 60 * 60 * 5)),
        batchSize: 200,
        useTransactionPerBatch: true,
        action: async (member: Member) => {
            member.forceSaveProperty('details');

            if (await member.save({
                skipMarkSaved: true,
                skipSendEvents: true,
            })) {
                realUpdate += 1;
            }
        },
    });

    console.log('Updated ' + realUpdate + ' members out of ' + result.total + ' looped members');
}
