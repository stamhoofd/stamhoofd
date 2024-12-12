import { Email } from '@stamhoofd/models';
import { receivableBalanceObjectContactInMemoryFilterCompilers, compileToInMemoryFilter, EmailRecipient, EmailRecipientFilterType, LimitedFilteredRequest, PaginatedResponse, Replacement, StamhoofdFilter } from '@stamhoofd/structures';
import { GetReceivableBalancesEndpoint } from '../endpoints/organization/dashboard/receivable-balances/GetReceivableBalancesEndpoint';
import { Formatter } from '@stamhoofd/utility';

async function fetch(query: LimitedFilteredRequest, subfilter: StamhoofdFilter | null) {
    const result = await GetReceivableBalancesEndpoint.buildData(query);

    // Map all contacts to recipients
    const compiledFilter = compileToInMemoryFilter(subfilter, receivableBalanceObjectContactInMemoryFilterCompilers);

    return new PaginatedResponse({
        results: result.results.flatMap((balance) => {
            return balance.object.contacts.filter(c => compiledFilter(c)).flatMap((contact) => {
                return contact.emails.map(email => EmailRecipient.create({
                    firstName: contact.firstName,
                    lastName: contact.lastName,
                    email,
                    replacements: [
                        Replacement.create({
                            token: 'objectName',
                            value: balance.object.name,
                        }),
                        Replacement.create({
                            // Deprecated: for backwards compatibility
                            token: 'organizationName',
                            value: balance.object.name,
                        }),
                        Replacement.create({
                            token: 'outstandingBalance',
                            value: Formatter.price(balance.amountOpen),
                        }),
                        ...(contact.meta && contact.meta.url && typeof contact.meta.url === 'string'
                            ? [Replacement.create({
                                    token: 'paymentUrl',
                                    value: contact.meta.url,
                                })]
                            : []),
                    ],
                }));
            });
        }),
        next: result.next,
    });
}

Email.recipientLoaders.set(EmailRecipientFilterType.ReceivableBalances, {
    fetch,

    // For now: only count the number of organizations - not the amount of emails
    count: async (query: LimitedFilteredRequest, subfilter: StamhoofdFilter | null) => {
        const q = await GetReceivableBalancesEndpoint.buildQuery(query);
        const base = await q.count();

        if (base < 1000) {
            // Do full scan
            query.limit = 1000;
            const result = await fetch(query, subfilter);
            return result.results.length;
        }

        return base;
    },
});
