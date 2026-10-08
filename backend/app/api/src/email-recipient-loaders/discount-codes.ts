import { Email, WebshopDiscountCode } from '@stamhoofd/models';
import { CountFilteredRequest, EmailRecipient, LimitedFilteredRequest, mergeFilters, PaginatedResponse } from '@stamhoofd/structures';
import { EmailRecipientFilterType } from '@stamhoofd/structures/email/EmailRecipientFilterType.js';

import { buildDiscountCodeReplacementsOptions, getEmailReplacementsForDiscountCode } from '../email-replacements/getEmailReplacementsForDiscountCode.js';
import { GetWebshopDiscountCodesEndpoint } from '../endpoints/organization/dashboard/webshops/GetDiscountCodesEndpoint.js';
import { LimitedFilteredRequestHelper } from '../helpers/LimitedFilteredRequestHelper.js';
import { discountCodeSorters } from '../sql-sorters/discount-codes.js';

function withEmailFilter(query: LimitedFilteredRequest): LimitedFilteredRequest {
    return new LimitedFilteredRequest({
        filter: mergeFilters([query.filter, {
            email: {
                $neq: null,
            },
        }, {
            email: {
                $neq: '',
            },
        }]),
        pageFilter: query.pageFilter,
        sort: query.sort,
        limit: query.limit,
        search: query.search,
    });
}

async function fetch(query: LimitedFilteredRequest) {
    const request = withEmailFilter(query);
    const sqlQuery = await GetWebshopDiscountCodesEndpoint.buildQuery(request, {
        webshopIds: await GetWebshopDiscountCodesEndpoint.getManagedWebshopIds(),
    });
    const data = await sqlQuery.fetch();
    const discountCodes = WebshopDiscountCode.fromRows(data, WebshopDiscountCode.table);
    const replacementOptions = await buildDiscountCodeReplacementsOptions(discountCodes);

    // The next page is built from the original query: the email filter is applied again on every page
    const next = LimitedFilteredRequestHelper.fixInfiniteLoadingLoop({
        request: new LimitedFilteredRequest({
            filter: query.filter,
            pageFilter: query.pageFilter,
            sort: request.sort,
            limit: query.limit,
            search: query.search,
        }),
        results: discountCodes,
        sorters: discountCodeSorters,
    });

    return new PaginatedResponse({
        results: discountCodes.flatMap((discountCode) => {
            if (!discountCode.email || discountCode.email.trim().length === 0) {
                return [];
            }

            return [
                EmailRecipient.create({
                    objectId: discountCode.id,
                    email: discountCode.email,
                    replacements: getEmailReplacementsForDiscountCode(discountCode, replacementOptions),
                }),
            ];
        }),
        next,
    });
}

async function count(query: LimitedFilteredRequest) {
    const request = withEmailFilter(query);
    const countRequest = new CountFilteredRequest({
        filter: request.filter,
        search: request.search,
    });
    const sqlQuery = await GetWebshopDiscountCodesEndpoint.buildQuery(countRequest, {
        webshopIds: await GetWebshopDiscountCodesEndpoint.getManagedWebshopIds(),
    });
    return await sqlQuery.count();
}

Email.recipientLoaders.set(EmailRecipientFilterType.WebshopDiscountCodes, { fetch, count });
