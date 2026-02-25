import { Email, Webshop } from '@stamhoofd/models';
import { EmailRecipient, EmailRecipientFilterType, LimitedFilteredRequest, mergeFilters, PaginatedResponse, WebshopPreview } from '@stamhoofd/structures';
import { GetWebshopOrdersEndpoint } from '../endpoints/organization/dashboard/webshops/GetWebshopOrdersEndpoint.js';
import { AuthenticatedStructures } from '../helpers/AuthenticatedStructures.js';
import { Context } from '../helpers/Context.js';

Email.recipientLoaders.set(EmailRecipientFilterType.Orders, {
    fetch: async (query: LimitedFilteredRequest) => {
        // #region get organization struct
        const organization = Context.organization;
        if (organization === undefined) {
            throw new Error('Organization is undefined');
        }
        const organizationStruct = organization.getBaseStructure();
        // #endregion

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
        // #endregion

        // #region get recipients
        const recipients: EmailRecipient[] = [];

        for (const order of result.results) {
            // todo: filter double emails? => should probably happen in query?
            const webshopPreview = webshopPreviewMap.get(order.webshopId)!;
            recipients.push(order.getEmailRecipient(organizationStruct, webshopPreview));
        }
        // #endregion

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
