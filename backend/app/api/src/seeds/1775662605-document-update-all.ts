import { Migration } from '@simonbackx/simple-database';
import { Document } from '@stamhoofd/models';

/**
 * Migrate the documents by decoding all documents and saving them.
 * The fieldAnswers will be upgraded and the property filters of the record answers will be converted automatically while decoding by convertOldPropertyFilter (see the decode method of PropertyFilter).
 */
export async function migrateDocuments() {
    let c = 0;
    
    const totalDocuments = await Document.select().count();

    for await (const document of Document.select().all()) {
            c++;
            if (c % 1000 === 0) {
                console.log('Processed', c, 'of', totalDocuments);
            }

            // document.buildContext(document).
            
            await document.save();
        }
}

export default new Migration(async () => {
    process.stdout.write('\n');
    console.log('Start updating year of document templates.');

    if (STAMHOOFD.userMode === 'platform') {
        console.log('skipped seed for userMode platform');
        return Promise.resolve();
    }
    
    await migrateDocuments();

    return Promise.resolve();
});
