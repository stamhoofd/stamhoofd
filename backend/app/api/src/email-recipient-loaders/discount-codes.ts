import { Email, WebshopDiscountCode } from '@stamhoofd/models';
import { CountFilteredRequest, EmailRecipient, EmailRecipientFilterType, getSortFilter, LimitedFilteredRequest, mergeFilters, PaginatedResponse } from '@stamhoofd/structures';

import { buildDiscountCodeReplacementsOptions, getEmailReplacementsForDiscountCode } from '../email-replacements/getEmailReplacementsForDiscountCode.js';
import { GetWebshopDiscountCodesEndpoint } from '../endpoints/organization/dashboard/webshops/GetDiscountCodesEndpoint.js';
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
    const sqlQuery = await GetWebshopDiscountCodesEndpoint.buildQuery(request);
    const data = await sqlQuery.fetch();
    const discountCodes = WebshopDiscountCode.fromRows(data, WebshopDiscountCode.table);
    const replacementOptions = await buildDiscountCodeReplacementsOptions(discountCodes);

    let next: LimitedFilteredRequest | undefined;

    if (discountCodes.length >= request.limit) {
        const lastObject = discountCodes[discountCodes.length - 1];
        const nextFilter = getSortFilter(lastObject, discountCodeSorters, request.sort);

        next = new LimitedFilteredRequest({
            filter: query.filter,
            pageFilter: nextFilter,
            sort: request.sort,
            limit: request.limit,
            search: request.search,
        });

        if (JSON.stringify(nextFilter) === JSON.stringify(request.pageFilter)) {
            console.error('Found infinite loading loop for', request);
            next = undefined;
        }
    }

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
    const sqlQuery = await GetWebshopDiscountCodesEndpoint.buildQuery(countRequest);
    return await sqlQuery.count();
}

Email.recipientLoaders.set(EmailRecipientFilterType.WebshopDiscountCodes, { fetch, count });
