import { Email, Member } from '@stamhoofd/models';
import { SQL } from '@stamhoofd/sql';
import { EmailRecipient, EmailRecipientFilterType, LimitedFilteredRequest, PaginatedResponse, Replacement } from '@stamhoofd/structures';
import { GetDocumentsEndpoint } from '../endpoints/organization/dashboard/documents/GetDocumentsEndpoint.js';

async function fetch(query: LimitedFilteredRequest) {
    const result = await GetDocumentsEndpoint.buildData(query);

    const recipients: EmailRecipient[] = [];
    const memberIds = new Set(result.results.map(doc => doc.memberId).filter(id => id !== null)); // silently skip null memberIds

    const members = await Member.getBlobByIds(...memberIds);
    for (const member of members) {
        const emails = member.details.getNotificationEmails();
        for (const user of member.users) {
            if (!emails.includes(user.email.toLocaleLowerCase())) {
                continue;
            }
            const recipient = EmailRecipient.create({
                objectId: member.id,
                userId: user.id,
                memberId: member.id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                replacements: [
                    Replacement.create({
                        token: 'firstNameMember',
                        value: member.firstName,
                    }),
                    Replacement.create({
                        token: 'lastNameMember',
                        value: member.lastName,
                    }),
                ],
            });
            recipients.push(recipient);
        }
    }

    return new PaginatedResponse({
        results: recipients,
        next: result.next,
    });
}

async function count(request: LimitedFilteredRequest) {
    const query = await GetDocumentsEndpoint.buildQuery(request);
    const uniqueMemberIds = await query.count(SQL.distinct(SQL.column('memberId')));

    if (uniqueMemberIds > 100 || uniqueMemberIds === 0) {
        return uniqueMemberIds; // rough estimate
    }
    // do full count
    request.limit = 100;
    let count = 0;
    let req: LimitedFilteredRequest | null = request;
    while (req) {
        const result = await fetch(request);
        count += result.results.length;
        req = result.next ?? null;
    }
    return count;
};

Email.recipientLoaders.set(EmailRecipientFilterType.Documents, { fetch, count });
