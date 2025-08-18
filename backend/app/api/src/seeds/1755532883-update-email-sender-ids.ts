import { Migration } from '@simonbackx/simple-database';
import { Email, Organization, Platform } from '@stamhoofd/models';

export default new Migration(async () => {
    if (STAMHOOFD.environment === 'test') {
        console.log('skipped in tests');
        return;
    }

    console.log('Start setting senderId of emails.');

    const batchSize = 100;
    let count = 0;
    const platform = await Platform.getShared();

    for await (const email of Email.select()
        .where('senderId', null).limit(batchSize).all()) {
        if (!email.fromAddress) {
            continue;
        }
        const organization = email.organizationId ? await Organization.getByID(email.organizationId) : null;
        if (!organization) {
            const sender = platform.privateConfig.emails.find(s => s.email === email.fromAddress);
            if (sender) {
                email.senderId = sender.id;
                await email.save();
                count += 1;
            }
            else {
                console.warn(`No sender found for email ${email.fromAddress} in platform config`);
            }
        }
        else {
            const sender = organization.privateMeta.emails.find(s => s.email === email.fromAddress);
            if (sender) {
                email.senderId = sender.id;
                await email.save();
                count += 1;
            }
            else {
                console.warn(`No sender found for email ${email.fromAddress} in organization ${organization.id}`);
            }
        }
    }

    console.log('Finished saving ' + count + ' emails.');
});
