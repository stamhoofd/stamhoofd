import { CachedBalance, Email } from '@stamhoofd/models';
import { SQL } from '@stamhoofd/sql';
import { BalanceItem as BalanceItemStruct, EmailRecipient, EmailRecipientFilterType, LimitedFilteredRequest, MembersBlob, PaginatedResponse, ReceivableBalanceType, Replacement, mergeFilters } from '@stamhoofd/structures';
import { GetMembersEndpoint } from '../endpoints/global/members/GetMembersEndpoint';
import { Context } from '../helpers/Context';
import { Formatter } from '@stamhoofd/utility';

async function getRecipients(result: PaginatedResponse<MembersBlob, LimitedFilteredRequest>, type: 'member' | 'parents' | 'unverified') {
    const recipients: EmailRecipient[] = [];

    const balanceItemModels = Context.organization ? await CachedBalance.balanceForObjects(Context.organization.id, result.results.members.map(m => m.id), ReceivableBalanceType.member) : [];

    for (const member of result.results.members) {
        const memberRecipients = member.getEmailRecipients([type]);

        if (Context.organization) {
            const balanceItems = balanceItemModels.filter(b => b.memberId === member.id).map(i => i.getStructure());

            const extraReplacements = [
                Replacement.create({
                    token: 'outstandingBalance',
                    value: Formatter.price(balanceItems.reduce((sum, i) => sum + i.priceOpen, 0)),
                }),
                Replacement.create({
                    token: 'balanceTable',
                    value: '',
                    html: BalanceItemStruct.getDetailsHTMLTable(balanceItems),
                }),
            ];

            for (const recipient of memberRecipients) {
                recipient.replacements.push(
                    ...extraReplacements,
                );
            }
        }

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
            email: {
                $neq: null,
            },
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
