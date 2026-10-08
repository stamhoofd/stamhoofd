import { Email, Webshop, WebshopDiscountCode } from '@stamhoofd/models';
import { CountFilteredRequest, EmailRecipient, LimitedFilteredRequest, mergeFilters, PaginatedResponse, PermissionLevel } from '@stamhoofd/structures';
import { EmailRecipientFilterType } from '@stamhoofd/structures/email/EmailRecipientFilterType.js';

import { buildDiscountCodeReplacementsOptions, getEmailReplacementsForDiscountCode } from '../email-replacements/getEmailReplacementsForDiscountCode.js';
import { GetWebshopDiscountCodesEndpoint } from '../endpoints/organization/dashboard/webshops/GetDiscountCodesEndpoint.js';
import { Context } from '../helpers/Context.js';
import { LimitedFilteredRequestHelper } from '../helpers/LimitedFilteredRequestHelper.js';
import { discountCodeSorters } from '../sql-sorters/discount-codes.js';

/**
 * Codes are secrets, so unlike orders they are limited to the webshops the user fully manages:
 * the webshop id in the filter comes from the client.
 */
async function getManagedWebshopIds(): Promise<string[]> {
    const webshops = await Webshop.where({ organizationId: Context.organization!.id });
    const ids: string[] = [];
    for (const webshop of webshops) {
        if (await Context.auth.canAccessWebshop(webshop, PermissionLevel.Full)) {
            ids.push(webshop.id);
        }
    }
    return ids;
}

async function withRecipientFilter(query: LimitedFilteredRequest): Promise<LimitedFilteredRequest> {
    return new LimitedFilteredRequest({
        filter: mergeFilters([query.filter, {
            webshopId: {
                $in: await getManagedWebshopIds(),
            },
        }, {
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
    const request = await withRecipientFilter(query);
    const sqlQuery = await GetWebshopDiscountCodesEndpoint.buildQuery(request);
    const data = await sqlQuery.fetch();
    const discountCodes = WebshopDiscountCode.fromRows(data, WebshopDiscountCode.table);
    const replacementOptions = await buildDiscountCodeReplacementsOptions(discountCodes);

    // The next page is built from the original query: the recipient filter is applied again on every page
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
    const request = await withRecipientFilter(query);
    const countRequest = new CountFilteredRequest({
        filter: request.filter,
        search: request.search,
    });
    const sqlQuery = await GetWebshopDiscountCodesEndpoint.buildQuery(countRequest);
    return await sqlQuery.count();
}

Email.recipientLoaders.set(EmailRecipientFilterType.WebshopDiscountCodes, { fetch, count });
