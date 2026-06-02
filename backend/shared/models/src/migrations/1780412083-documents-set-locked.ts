import { Database, Migration } from '@simonbackx/simple-database';

export default new Migration(async () => {
    process.stdout.write('\n');

    if (STAMHOOFD.userMode === 'platform') {
        console.log('Skipped set documents locked for userMode platform.');
        return Promise.resolve();
    }

    console.log('Start locking document templates.');
    await Database.statement(`update document_templates set isLocked = 1 where status = 'Published';`);

    console.log('Start locking documents.');
    await Database.statement(`update documents set isLocked = 1 where status = 'Published';`);

    return Promise.resolve();
});
