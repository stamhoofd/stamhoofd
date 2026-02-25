import { Email, Organization, User } from '@stamhoofd/models';
import { SQL } from '@stamhoofd/sql';
import { EmailStatus } from '@stamhoofd/structures';
import { ContextInstance } from './Context.js';

export async function resumeEmails() {
    const query = SQL.select()
        .from(SQL.table(Email.table))
        .where(SQL.column('status'), [EmailStatus.Sending, EmailStatus.Queued]);

    const result = await query.fetch();
    const emails = Email.fromRows(result, Email.table);

    for (const email of emails) {
        console.log('Resuming email that has sending status on boot', email.id);

        const user = email.userId ? (await User.getByID(email.userId)) : await User.getSystem();
        if (!user) {
            console.warn('Cannot retry sending email because user not found', email.id);
            continue;
        }

        const organization = email.organizationId ? (await Organization.getByID(email.organizationId)) : null;
        if (organization === undefined) {
            console.warn('Cannot retry sending email because organization not found', email.id);
            continue;
        }

        try {
            await ContextInstance.startForUser(user, organization, async () => {
                await email.resumeSending();
            });
        }
        catch (e) {
            console.error('Error resuming email', email.id, e);
        }
    }
}
