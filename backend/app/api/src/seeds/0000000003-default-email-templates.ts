import { Database, Migration } from '@simonbackx/simple-database';
import { EmailTemplate } from '@stamhoofd/models';
import { promises as fs } from 'fs';

export default new Migration(async () => {
    // Check if total email templates is 0
    const firstEmailTemplate = await EmailTemplate.select().where('organizationId', null).first(false);
    if (firstEmailTemplate) {
        console.log('Skipped, email templates already exist');
        return;
    }

    // Insert defaults
    console.log('Inserting default email templates');
    const sqlStatement = await fs.readFile(__dirname + '/data/default-email-templates.sql', { encoding: 'utf-8' });
    await Database.statement(sqlStatement);

    // Do something here
    return Promise.resolve();
});
