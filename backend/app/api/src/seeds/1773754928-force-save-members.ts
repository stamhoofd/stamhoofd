import { Migration } from '@simonbackx/simple-database';
import { Member, Registration } from '@stamhoofd/models';
import { LoggingTools } from '@stamhoofd/utility';
import { SeedTools } from '../helpers/SeedTools.js';

export default new Migration(async () => {
    process.stdout.write('\n');

    await migrateMembers();
    await migrateRegistrations();
});

async function migrateMembers() {
    console.log('Start updating members.');

    const batchProcessor = SeedTools.createBatchProcessor({
        batchSize: 100,
        action: async (member: Member) => {
            member.forceSaveProperty('details');
            await member.save();
        },
    });

    const memberProgressLogger = await LoggingTools.createProgressLoggerFromQuery(Member.select());
    batchProcessor.setProgressLogger(memberProgressLogger);

    for await (const member of Member.select().all()) {
        await batchProcessor.execute(member);
    }

    await batchProcessor.finish();
}

async function migrateRegistrations() {
    console.log('Start updating registrations.');

    const batchProcessor = SeedTools.createBatchProcessor({
        batchSize: 100,
        action: async (registration: Registration) => {
            registration.forceSaveProperty('groupPrice');
            await registration.save();
        },
    });

    const registrationProgressLogger = await LoggingTools.createProgressLoggerFromQuery(Registration.select());
    batchProcessor.setProgressLogger(registrationProgressLogger);

    for await (const registration of Registration.select().all()) {
        await batchProcessor.execute(registration);
    }

    await batchProcessor.finish();
}
