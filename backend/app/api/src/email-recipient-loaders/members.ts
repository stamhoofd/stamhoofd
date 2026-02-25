import { Email } from '@stamhoofd/models';
import { SQL } from '@stamhoofd/sql';
import { EmailRecipient, EmailRecipientFilterType, LimitedFilteredRequest, MembersBlob, PaginatedResponse, mergeFilters } from '@stamhoofd/structures';
import { GetMembersEndpoint } from '../endpoints/global/members/GetMembersEndpoint.js';

async function getRecipients(result: PaginatedResponse<MembersBlob, LimitedFilteredRequest>, type: 'member' | 'parents' | 'unverified') {
    const recipients: EmailRecipient[] = [];

    for (const member of result.results.members) {
        const memberRecipients = member.getEmailRecipients([type]);
        recipients.push(...memberRecipients);
    }
    return recipients;
}

Email.recipientLoaders.set(EmailRecipientFilterType.Members, {
    fetch: async (query: LimitedFilteredRequest) => {
        const result = await GetMembersEndpoint.buildData(query);

        return new PaginatedResponse({
            results: await getRecipients(result, 'member'),
            next: result.next,
        });
    },

    count: async (query: LimitedFilteredRequest) => {
        query.filter = mergeFilters([query.filter, {
            $and: [
                {
                    email: {
                        $neq: null,
                    },
                },
                {
                    email: {
                        $neq: '',
                    },
                },
            ],

        }]);
        const q = await GetMembersEndpoint.buildQuery(query);
        return await q.count();
    },
});

Email.recipientLoaders.set(EmailRecipientFilterType.MemberParents, {
    fetch: async (query: LimitedFilteredRequest) => {
        const result = await GetMembersEndpoint.buildData(query);

        return new PaginatedResponse({
            results: await getRecipients(result, 'parents'),
            next: result.next,
        });
    },

    count: async (query: LimitedFilteredRequest) => {
        const q = await GetMembersEndpoint.buildQuery(query);
        return await q.sum(
            SQL.jsonLength(SQL.column('details'), '$.value.parents[*].email'),
        );
    },
});

Email.recipientLoaders.set(EmailRecipientFilterType.MemberUnverified, {
    fetch: async (query: LimitedFilteredRequest) => {
        const result = await GetMembersEndpoint.buildData(query);

        return new PaginatedResponse({
            results: await getRecipients(result, 'unverified'),
            next: result.next,
        });
    },

    count: async (query: LimitedFilteredRequest) => {
        const q = await GetMembersEndpoint.buildQuery(query);
        return await q.sum(
            SQL.jsonLength(SQL.column('details'), '$.value.unverifiedEmails'),
        );
    },
});
