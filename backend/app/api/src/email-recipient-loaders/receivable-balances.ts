import { CachedBalance, Email } from '@stamhoofd/models';
import { BalanceItem as BalanceItemStruct, compileToInMemoryFilter, EmailRecipient, EmailRecipientFilterType, LimitedFilteredRequest, PaginatedResponse, receivableBalanceObjectContactInMemoryFilterCompilers, ReceivableBalanceType, Replacement, StamhoofdFilter } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { GetReceivableBalancesEndpoint } from '../endpoints/organization/dashboard/receivable-balances/GetReceivableBalancesEndpoint.js';

async function fetch(query: LimitedFilteredRequest, subfilter: StamhoofdFilter | null) {
    const result = await GetReceivableBalancesEndpoint.buildData(query);

    // Map all contacts to recipients
    const compiledFilter = compileToInMemoryFilter(subfilter, receivableBalanceObjectContactInMemoryFilterCompilers);

    // const balanceItemModels = await CachedBalance.balanceForObjects(organization.id, [request.params.id], request.params.type);
    // const balanceItems = await BalanceItem.getStructureWithPayments(balanceItemModels);

    const recipients: EmailRecipient[] = [];
    for (const balance of result.results) {
        const balanceItemModels = balance.objectType === ReceivableBalanceType.organization ? (await CachedBalance.balanceForObjects(balance.organizationId, [balance.object.id], balance.objectType)) : [];
        const balanceItems = balanceItemModels.map(i => i.getStructure());

        const filteredContacts = balance.object.contacts.filter(c => compiledFilter(c));
        for (const contact of filteredContacts) {
            for (const email of contact.emails) {
                const recipient = EmailRecipient.create({
                    objectId: balance.id, // Note: not set member, user or organization id here - should be the queryable balance id
                    userId: balance.objectType === ReceivableBalanceType.user || balance.objectType === ReceivableBalanceType.userWithoutMembers ? balance.object.id : null,
                    memberId: balance.objectType === ReceivableBalanceType.member ? balance.object.id : null,
                    firstName: contact.firstName,
                    lastName: contact.lastName,
                    email,
                    replacements: [
                        Replacement.create({
                            token: 'objectName',
                            value: balance.object.name,
                        }),
                        ...(
                            balance.objectType === ReceivableBalanceType.organization
                                ? [
                                        Replacement.create({
                                            token: 'outstandingBalance',
                                            value: Formatter.price(balance.amountOpen),
                                        }),
                                        Replacement.create({
                                            token: 'balanceTable',
                                            value: '',
                                            html: BalanceItemStruct.getDetailsHTMLTable(balanceItems),
                                        }),
                                    ]
                                : []
                        ),

                        ...(contact.meta && contact.meta.url && typeof contact.meta.url === 'string'
                            ? [Replacement.create({
                                    token: 'paymentUrl',
                                    value: contact.meta.url,
                                })]
                            : []),
                    ],
                });
                recipients.push(recipient);
            }
        }
    }

    return new PaginatedResponse({
        results: recipients,
        next: result.next,
    });
}

Email.recipientLoaders.set(EmailRecipientFilterType.ReceivableBalances, {
    fetch,

    // For now: only count the number of organizations - not the amount of emails
    count: async (query: LimitedFilteredRequest, subfilter: StamhoofdFilter | null) => {
        const q = await GetReceivableBalancesEndpoint.buildQuery(query);
        return await q.count();
    },
});
