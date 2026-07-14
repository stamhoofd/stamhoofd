import { Email, runWithRecipientLocale, Webshop } from '@stamhoofd/models';
import type { EmailRecipient, LimitedFilteredRequest, WebshopPreview } from '@stamhoofd/structures';
import { mergeFilters, PaginatedResponse } from '@stamhoofd/structures';
import { GetWebshopOrdersEndpoint } from '../endpoints/organization/dashboard/webshops/GetWebshopOrdersEndpoint.js';
import { AuthenticatedStructures } from '../helpers/AuthenticatedStructures.js';
import { Context } from '../helpers/Context.js';
import { EmailRecipientFilterType } from '@stamhoofd/structures/email/EmailRecipientFilterType.js';

Email.recipientLoaders.set(EmailRecipientFilterType.Orders, {
    fetch: async (query: LimitedFilteredRequest) => {
        const organization = Context.organization;
        if (organization === undefined) {
            throw new Error('Organization is undefined');
        }
        const organizationStruct = organization.getBaseStructure();

        const result = await GetWebshopOrdersEndpoint.buildData(query);

        // #region get webshop previews
        const webshopIds = new Set(result.results.map(order => order.webshopId));
        const webshopPreviewMap = new Map<string, WebshopPreview>();

        for (const webshopId of webshopIds) {
            const webshop = await Webshop.getByID(webshopId);

            if (webshop === undefined) {
            // todo: change error?
                throw new Error('Webshop is undefined');
            }

            webshopPreviewMap.set(webshopId, AuthenticatedStructures.webshopPreview(webshop));
        }

        const recipients: EmailRecipient[] = [];

        for (const order of result.results) {
            const webshopPreview = webshopPreviewMap.get(order.webshopId)!;
            runWithRecipientLocale({ language: order.consumerLanguage }, organization, () => {
                recipients.push(order.getEmailRecipient(organizationStruct, webshopPreview));
            });
        }

        return new PaginatedResponse({
            results: recipients,
            next: result.next,
        });
    },

    count: async (query: LimitedFilteredRequest) => {
        query.filter = mergeFilters([query.filter, {
            email: {
                $neq: null,
            },
        }]);
        const q = await GetWebshopOrdersEndpoint.buildQuery(query);
        return await q.count();
    },
});
