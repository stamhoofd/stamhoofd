import { Email } from "@stamhoofd/models";
import { SQL } from "@stamhoofd/sql";
import { EmailStatus } from "@stamhoofd/structures";

export async function resumeEmails() {
    const query = SQL.select()
        .from(SQL.table(Email.table))
        .where(SQL.column('status'), EmailStatus.Sending);

    const result = await query.fetch();
    const emails = Email.fromRows(result, Email.table);

    for (const email of emails) {
        console.log('Resuming email that has sending status on boot', email.id);
        await email.send()
    }
}
