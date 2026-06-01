import { Migration } from '@simonbackx/simple-database';
import { DocumentTemplate } from '@stamhoofd/models';

export async function lockAllTemplates() {
    let c = 0;
    const totalDocuments = await DocumentTemplate.select().count();

    for await (const document of DocumentTemplate.select().all()) {
        c++;
        if (c % 1000 === 0) {
            console.log('Processed', c, 'of', totalDocuments);
        }

        // check
        if (!document.isLocked) {
            document.isLocked = true;

            // set force save to true (else an error will be thrown)
            await document.save(true);
        }
    }
};

export default new Migration(async () => {
    process.stdout.write('\n');
    console.log('Start locking document templates.');

    if (STAMHOOFD.environment === 'test') {
        console.log('skipped in tests');
        return;
    }

    if (STAMHOOFD.userMode !== 'organization') {
        console.log('skipped seed because usermode not organization');
        return;
    }

    await lockAllTemplates();

    return Promise.resolve();
});
