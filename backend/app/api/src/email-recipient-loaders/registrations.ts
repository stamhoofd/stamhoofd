import { Email, Member } from '@stamhoofd/models';
import { SQL } from '@stamhoofd/sql';
import { EmailRecipient, EmailRecipientFilterType, LimitedFilteredRequest, PaginatedResponse, RegistrationsBlob, mergeFilters } from '@stamhoofd/structures';
import { GetRegistrationsEndpoint } from '../endpoints/global/registration/GetRegistrationsEndpoint.js';
import { memberJoin } from '../sql-filters/registrations.js';

async function getRecipients(result: PaginatedResponse<RegistrationsBlob, LimitedFilteredRequest>, type: 'member' | 'parents' | 'unverified') {
    const recipients: EmailRecipient[] = [];

    for (const registration of result.results.registrations) {
        const memberRecipients = registration.member.getEmailRecipients([type]);
        recipients.push(...memberRecipients);
    }
    return recipients;
}

Email.recipientLoaders.set(EmailRecipientFilterType.RegistrationMembers, {
    fetch: async (query: LimitedFilteredRequest) => {
        const result = await GetRegistrationsEndpoint.buildData(query);

        return new PaginatedResponse({
            results: await getRecipients(result, 'member'),
            next: result.next,
        });
    },

    count: async (query: LimitedFilteredRequest) => {
        query.filter = mergeFilters([query.filter, {
            member: {
                $elemMatch: {
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
                },
            },
        }]);
        const q = await GetRegistrationsEndpoint.buildQuery(query);
        return await q.count();
    },
});

Email.recipientLoaders.set(EmailRecipientFilterType.RegistrationParents, {
    fetch: async (query: LimitedFilteredRequest) => {
        const result = await GetRegistrationsEndpoint.buildData(query);

        return new PaginatedResponse({
            results: await getRecipients(result, 'parents'),
            next: result.next,
        });
    },

    count: async (query: LimitedFilteredRequest) => {
        const q = (await GetRegistrationsEndpoint.buildQuery(query)).join(memberJoin);

        return await q.sum(
            SQL.jsonLength(SQL.column(Member.table, 'details'), '$.value.parents[*].email'),
        );
    },
});

Email.recipientLoaders.set(EmailRecipientFilterType.RegistrationUnverified, {
    fetch: async (query: LimitedFilteredRequest) => {
        const result = await GetRegistrationsEndpoint.buildData(query);

        return new PaginatedResponse({
            results: await getRecipients(result, 'unverified'),
            next: result.next,
        });
    },

    count: async (query: LimitedFilteredRequest) => {
        const q = (await GetRegistrationsEndpoint.buildQuery(query)).join(memberJoin);

        return await q.sum(
            SQL.jsonLength(SQL.column(Member.table, 'details'), '$.value.unverifiedEmails'),
        );
    },
});
