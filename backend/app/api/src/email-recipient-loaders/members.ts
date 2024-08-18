import { Email } from "@stamhoofd/models";
import { SQL } from "@stamhoofd/sql";
import { EmailRecipientFilterType, LimitedFilteredRequest, PaginatedResponse, mergeFilters } from "@stamhoofd/structures";
import { GetMembersEndpoint } from "../endpoints/global/members/GetMembersEndpoint";

Email.recipientLoaders.set(EmailRecipientFilterType.Members, {
    fetch: async (query: LimitedFilteredRequest) => {
        const result = await GetMembersEndpoint.buildData(query)

        return new PaginatedResponse({
            results: result.results.members.flatMap(m => m.getEmailRecipients(['member'])),
            next: result.next
        });
    },

    count: async (query: LimitedFilteredRequest) => {
        query.filter = mergeFilters([query.filter, {
            'email': {
                $neq: null
            }
        }])
        const q = await GetMembersEndpoint.buildQuery(query)
        return await q.count();
    }
});

Email.recipientLoaders.set(EmailRecipientFilterType.MemberParents, {
    fetch: async (query: LimitedFilteredRequest) => {
        const result = await GetMembersEndpoint.buildData(query)

        return new PaginatedResponse({
            results: result.results.members.flatMap(m => m.getEmailRecipients(['parents'])),
            next: result.next
        });
    },

    count: async (query: LimitedFilteredRequest) => {
        const q = await GetMembersEndpoint.buildQuery(query)
        return await q.sum(
            SQL.jsonLength(SQL.column('details'), '$.value.parents[*].email')
        );
    }
});

Email.recipientLoaders.set(EmailRecipientFilterType.MemberUnverified, {
    fetch: async (query: LimitedFilteredRequest) => {
        const result = await GetMembersEndpoint.buildData(query)

        return new PaginatedResponse({
            results: result.results.members.flatMap(m => m.getEmailRecipients(['unverified'])),
            next: result.next
        });
    },

    count: async (query: LimitedFilteredRequest) => {
        const q = await GetMembersEndpoint.buildQuery(query)
        return await q.sum(
            SQL.jsonLength(SQL.column('details'), '$.value.unverifiedEmails')
        );
    }
});
