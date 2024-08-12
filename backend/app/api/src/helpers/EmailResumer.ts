import { Email, Organization, User } from "@stamhoofd/models";
import { SQL } from "@stamhoofd/sql";
import { EmailStatus } from "@stamhoofd/structures";
import { ContextInstance } from "./Context";

export async function resumeEmails() {
    const query = SQL.select()
        .from(SQL.table(Email.table))
        .where(SQL.column('status'), EmailStatus.Sending);

    const result = await query.fetch();
    const emails = Email.fromRows(result, Email.table);

    for (const email of emails) {
        if (!email.userId) {
            console.warn('Cannot retry sending email because userId is not set - which is required for setting the scope', email.id)
            continue;
        }
        console.log('Resuming email that has sending status on boot', email.id);

        const user = await User.getByID(email.userId);
        if (!user) {
            console.warn('Cannot retry sending email because user not found', email.id)
            continue;
        }

        const organization = email.organizationId ? (await Organization.getByID(email.organizationId)) : null;
        if (organization === undefined) {
            console.warn('Cannot retry sending email because organization not found', email.id)
            continue;
        }
        
        await ContextInstance.startForUser(user, organization, async () => {
            await email.send()
        })
    }
}
