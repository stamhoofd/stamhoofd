import { Migration } from '@simonbackx/simple-database';
import { DocumentTemplate } from '@stamhoofd/models';
import { SQL } from '@stamhoofd/sql';
import { DocumentStatus } from '@stamhoofd/structures';

export async function initPublishedAtForPublishedDocuments() {
    await SQL.update(DocumentTemplate.table)
        .set('publishedAt', SQL.column('createdAt'))
        .where('publishedAt', null)
        .where('status', DocumentStatus.Published)
        .update();
};

export default new Migration(async () => {
    process.stdout.write('\n');
    console.log('Start init published at for published documents.');
    await initPublishedAtForPublishedDocuments();

    return Promise.resolve();
});
