import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { BalanceItem, Order, Webshop } from '@stamhoofd/models';
import { PermissionLevel } from '@stamhoofd/structures';

import { Context } from '../../../../helpers/Context.js';
import { UitpasService } from '../../../../services/uitpas/UitpasService.js';
import { SimpleError } from '@simonbackx/simple-errors';

type Params = { id: string };
type Query = undefined;
type Body = undefined;
type ResponseBody = undefined;

/**
 * One endpoint to create, patch and delete groups. Usefull because on organization setup, we need to create multiple groups at once. Also, sometimes we need to link values and update multiple groups at once
 */

export class DeleteWebshopEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'DELETE') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/webshop/@id', { id: String });

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOrganizationScope();
        await Context.authenticate();

        // Fast throw first (more in depth checking for patches later)
        if (!await Context.auth.hasSomeAccess(organization.id)) {
            throw Context.auth.error();
        }

        const webshop = await Webshop.getByID(request.params.id);
        if (!webshop || !await Context.auth.canAccessWebshop(webshop, PermissionLevel.Full)) {
            throw Context.auth.notFoundOrNoAccess();
        }

        if (await UitpasService.areThereRegisteredTicketSales(webshop.id)) {
            throw new SimpleError({
                code: 'webshop_has_registered_ticket_sales',
                message: `Webshop ${webshop.id} has registered ticket sales`,
                human: $t(`0b3d6ea1-a70b-428c-9ba4-cc0c327ed415`),
            });
        }

        const orders = await Order.where({ webshopId: webshop.id });
        await BalanceItem.deleteForDeletedOrders(orders.map(o => o.id));
        await webshop.delete();
        return new Response(undefined);
    }
}
